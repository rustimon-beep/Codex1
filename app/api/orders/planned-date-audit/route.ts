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

type FirstOverdueItem = {
  order_item_id: number;
  order_id: number;
  supplier_id: number | null;
  first_planned_date: string | null;
};

type PlannedDateHistoryEntry = {
  order_item_id: number;
  order_id: number;
  supplier_id: number | null;
  previous_planned_date: string | null;
  next_planned_date: string | null;
  changed_by: string;
  changed_at: string;
  changed_after_overdue: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      firstOverdueItems?: FirstOverdueItem[];
      plannedDateHistoryEntries?: PlannedDateHistoryEntry[];
    };

    const firstOverdueItems = body.firstOverdueItems || [];
    const plannedDateHistoryEntries = body.plannedDateHistoryEntries || [];
    const supabase = getAdminSupabase();

    if (firstOverdueItems.length > 0) {
      const itemIds = firstOverdueItems.map((item) => item.order_item_id);
      const { data: existingRows, error: existingError } = await supabase
        .from("order_item_first_overdue")
        .select("order_item_id")
        .in("order_item_id", itemIds);

      if (existingError) {
        throw existingError;
      }

      const existingIds = new Set((existingRows || []).map((row) => row.order_item_id as number));
      const freshItems = firstOverdueItems.filter((item) => !existingIds.has(item.order_item_id));

      if (freshItems.length > 0) {
        const { error } = await supabase.from("order_item_first_overdue").insert(freshItems);

        if (error) {
          throw error;
        }
      }
    }

    if (plannedDateHistoryEntries.length > 0) {
      const { error } = await supabase
        .from("order_item_schedule_history")
        .insert(plannedDateHistoryEntries);

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Planned date audit failed" },
      { status: 500 }
    );
  }
}
