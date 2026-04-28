import { supabase } from "../supabase";
import type { ItemForm, OrderWithItems, UserProfile } from "./types";

type OrderHeaderPayload = {
  client_order: string;
  order_date: string;
  order_type: string;
  supplier_id: number | null;
  comment: string;
  updated_by: string;
  updated_at: string;
};

type OrderItemPayload = {
  order_id: number;
  article: string;
  replacement_article: string | null;
  name: string;
  quantity: string;
  planned_date: string | null;
  initial_planned_date?: string | null;
  planned_date_change_count?: number;
  planned_date_last_changed_at?: string | null;
  planned_date_last_changed_by?: string | null;
  status: string;
  delivered_date: string | null;
  canceled_date: string | null;
};

function toLegacyOrderItemPayload(payload: OrderItemPayload) {
  const {
    initial_planned_date,
    planned_date_change_count,
    planned_date_last_changed_at,
    planned_date_last_changed_by,
    ...legacyPayload
  } = payload;

  return legacyPayload;
}

function applyOrderScope<T extends { eq: (column: string, value: unknown) => T }>(
  query: T,
  user?: UserProfile | null
) {
  if (user?.role !== "supplier") return query;
  if (!user.supplier_id) return query.eq("supplier_id", -1);
  return query.eq("supplier_id", user.supplier_id);
}

export async function fetchOrders(user?: UserProfile | null) {
  const primaryQuery = supabase
    .from("orders_v2")
    .select("*, supplier:suppliers(id, name), order_items(*)")
    .order("id", { ascending: false });

  const primaryResult = await applyOrderScope(primaryQuery, user);
  if (!primaryResult.error) return primaryResult;

  return supabase
    .from("orders_v2")
    .select("*, order_items(*)")
    .order("id", { ascending: false });
}

export async function fetchOrderById(orderId: number, user?: UserProfile | null) {
  const primaryQuery = supabase
    .from("orders_v2")
    .select("*, supplier:suppliers(id, name), order_items(*)")
    .eq("id", orderId);

  const primaryResult = await applyOrderScope(primaryQuery, user).single();
  if (!primaryResult.error) return primaryResult;

  return supabase
    .from("orders_v2")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();
}

export async function updateOrderHeader(orderId: number, payload: OrderHeaderPayload) {
  return supabase
    .from("orders_v2")
    .update({
      client_order: payload.client_order,
      order_date: payload.order_date,
      order_type: payload.order_type,
      supplier_id: payload.supplier_id,
      comment: payload.comment,
      updated_by: payload.updated_by,
      updated_at: payload.updated_at,
    })
    .eq("id", orderId);
}

export async function createOrderHeader(payload: OrderHeaderPayload) {
  return supabase.from("orders_v2").insert(payload).select().single();
}

export async function deleteOrderItems(itemIds: number[]) {
  return supabase.from("order_items").delete().in("id", itemIds);
}

export function buildOrderItemPayload(orderId: number, item: ItemForm): OrderItemPayload {
  return {
    order_id: orderId,
    article: item.article,
    replacement_article: item.hasReplacement ? item.replacementArticle : null,
    name: item.name,
    quantity: item.quantity,
    planned_date: item.plannedDate || null,
    initial_planned_date: item.initialPlannedDate || item.plannedDate || null,
    planned_date_change_count: item.plannedDateChangeCount || 0,
    planned_date_last_changed_at: item.plannedDateLastChangedAt || null,
    planned_date_last_changed_by: item.plannedDateLastChangedBy || null,
    status: item.status,
    delivered_date: item.deliveredDate || null,
    canceled_date: item.canceledDate || null,
  };
}

export async function updateOrderItem(itemId: number, payload: OrderItemPayload) {
  const result = await supabase.from("order_items").update(payload).eq("id", itemId);

  if (!result.error) return result;

  return supabase
    .from("order_items")
    .update(toLegacyOrderItemPayload(payload))
    .eq("id", itemId);
}

export async function createOrderItem(payload: OrderItemPayload) {
  const result = await supabase.from("order_items").insert(payload);

  if (!result.error) return result;

  return supabase.from("order_items").insert(toLegacyOrderItemPayload(payload));
}

export async function deleteOrderById(orderId: number) {
  return supabase.from("orders_v2").delete().eq("id", orderId);
}

export async function deleteItemsByOrderId(orderId: number) {
  return supabase.from("order_items").delete().eq("order_id", orderId);
}

export async function registerFirstOverdueItem(payload: {
  order_item_id: number;
  order_id: number;
  supplier_id: number | null;
  first_planned_date: string | null;
}) {
  return supabase.from("order_item_first_overdue").upsert(payload, {
    onConflict: "order_item_id",
    ignoreDuplicates: true,
  });
}

export async function createPlannedDateHistoryEntry(payload: {
  order_item_id: number;
  order_id: number;
  supplier_id: number | null;
  previous_planned_date: string | null;
  next_planned_date: string | null;
  changed_by: string;
  changed_at: string;
  changed_after_overdue: boolean;
}) {
  return supabase.from("order_item_schedule_history").insert(payload);
}

export async function persistPlannedDateAudit(payload: {
  firstOverdueItems?: Array<{
    order_item_id: number;
    order_id: number;
    supplier_id: number | null;
    first_planned_date: string | null;
  }>;
  plannedDateHistoryEntries?: Array<{
    order_item_id: number;
    order_id: number;
    supplier_id: number | null;
    previous_planned_date: string | null;
    next_planned_date: string | null;
    changed_by: string;
    changed_at: string;
    changed_after_overdue: boolean;
  }>;
}) {
  const response = await fetch("/api/orders/planned-date-audit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return { error: null as null };
  }

  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return {
    error: {
      message: data.error || "Не удалось сохранить аудит изменения срока.",
    },
  };
}

export async function markItemAsDelivered(itemId: number, deliveredDate: string) {
  return supabase
    .from("order_items")
    .update({
      status: "Поставлен",
      delivered_date: deliveredDate,
      canceled_date: null,
    })
    .eq("id", itemId);
}

export async function updateOrderMetadata(params: {
  orderId: number;
  updatedBy: string;
  updatedAt: string;
  comment: string;
}) {
  return supabase
    .from("orders_v2")
    .update({
      updated_by: params.updatedBy,
      updated_at: params.updatedAt,
      comment: params.comment,
    })
    .eq("id", params.orderId);
}

export async function updateItemQuickStatus(
  itemId: number,
  payload: {
    status: string;
    delivered_date?: string | null;
    canceled_date?: string | null;
  }
) {
  return supabase.from("order_items").update(payload).eq("id", itemId);
}

export function getExistingItemIds(orders: OrderWithItems[], orderId: number) {
  return orders.find((x) => x.id === orderId)?.order_items?.map((x) => x.id) || [];
}
