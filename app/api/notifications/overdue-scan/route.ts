import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createOverdueNotificationEventsForOrders,
  registerFirstOverdueItems,
} from "../../../../lib/notifications/server-events";

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

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const bearer = request.headers.get("authorization");
  return bearer === `Bearer ${cronSecret}`;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getAdminSupabase();
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("orders_v2")
      .select(
        "id, client_order, supplier_id, order_items!left(id, planned_date, status, delivered_date, canceled_date)"
      )
      .not("order_items", "is", null);

    if (error) {
      throw error;
    }

    const overdueOrders = (data || []).filter((order) =>
      (order.order_items || []).some((item: {
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
    );

    const overdueItems = overdueOrders.flatMap((order) =>
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

    await registerFirstOverdueItems(overdueItems);

    await createOverdueNotificationEventsForOrders(
      overdueOrders.map((order) => ({
        id: order.id,
        client_order: order.client_order || null,
        supplier_id: order.supplier_id || null,
      }))
    );

    return NextResponse.json({
      ok: true,
      overdueCount: overdueOrders.length,
      overdueItemsCount: overdueItems.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Overdue scan failed",
      },
      { status: 500 }
    );
  }
}
