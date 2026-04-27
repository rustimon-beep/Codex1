import { supabase } from "../supabase";
import type { SupplierSummary } from "../orders/types";

export async function fetchSuppliers() {
  const result = await supabase
    .from("suppliers")
    .select("id, name")
    .order("name", { ascending: true });

  if (!result.error) return result;

  return {
    data: [],
    error: null,
  };
}

export function mapSuppliers(data: SupplierSummary[] | null | undefined) {
  return (data || []).filter((supplier) => !!supplier?.id && !!supplier?.name?.trim());
}
