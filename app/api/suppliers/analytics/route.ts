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
      .select("order_id, supplier_id");

    if (error) {
      throw error;
    }

    const historicalOverdueBySupplier: Record<string, number> = {};

    for (const row of data || []) {
      const supplierKey = row.supplier_id ? String(row.supplier_id) : "unassigned";
      historicalOverdueBySupplier[supplierKey] = (historicalOverdueBySupplier[supplierKey] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      historicalOverdueBySupplier,
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
