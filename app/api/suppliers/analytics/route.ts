import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { registerFirstOverdueItems } from "../../../../lib/notifications/server-events";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getAdminSupabase() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function GET() {
  try {
    const supabase = getAdminSupabase();
    const today = new Date().toISOString().slice(0, 10);

    const { data: ordersWithItems, error: ordersError } = await supabase
      .from("orders_v2")
      .select(
        "id, supplier_id, order_items!left(id, planned_date, status, delivered_date, canceled_date)"
      )
      .not("order_items", "is", null);

    if (ordersError) {
      throw ordersError;
    }

    const currentOverdueItems = (ordersWithItems || []).flatMap((order) =>
      (order.order_items || [])
        .filter((item: {
          id: number;
          planned_date: string | null;
          status: string | null;
          delivered_date: string | null;
          canceled_date: string | null;
        }) => {
          const plannedDate = (item.planned_date || "").slice(0, 10);
          const delivered = item.status === "Поставлен" || !!item.delivered_date;
          const canceled = item.status === "Отменен" || !!item.canceled_date;

          return !!plannedDate && plannedDate < today && !delivered && !canceled;
        })
        .map((item: { id: number; planned_date: string | null }) => ({
          order_item_id: item.id,
          order_id: order.id,
          supplier_id: order.supplier_id || null,
          first_planned_date: item.planned_date ? item.planned_date.slice(0, 10) : null,
        }))
    );

    await registerFirstOverdueItems(currentOverdueItems);

    const { data, error } = await supabase
      .from("order_item_first_overdue")
      .select("order_id, supplier_id, first_overdue_at");

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      overdueEntries: (data || []).map((row) => ({
        orderId: row.order_id,
        supplierId: row.supplier_id,
        firstOverdueAt: row.first_overdue_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Supplier analytics failed",
      },
      { status: 500 }
    );
  }
}
