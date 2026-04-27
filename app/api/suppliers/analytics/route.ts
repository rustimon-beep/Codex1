import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
