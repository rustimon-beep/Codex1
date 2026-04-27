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
  status: string;
  delivered_date: string | null;
  canceled_date: string | null;
};

function applyOrderScope<T extends { eq: (column: string, value: unknown) => T }>(
  query: T,
  user?: UserProfile | null
) {
  if (user?.role !== "supplier") return query;
  if (!user.supplier_id) return query.eq("supplier_id", -1);
  return query.eq("supplier_id", user.supplier_id);
}

export async function fetchOrders(user?: UserProfile | null) {
  const query = supabase
    .from("orders_v2")
    .select("*, supplier:suppliers(id, name), order_items(*)")
    .order("id", { ascending: false });

  return applyOrderScope(query, user);
}

export async function fetchOrderById(orderId: number, user?: UserProfile | null) {
  const query = supabase
    .from("orders_v2")
    .select("*, supplier:suppliers(id, name), order_items(*)")
    .eq("id", orderId);

  return applyOrderScope(query, user).single();
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
    status: item.status,
    delivered_date: item.deliveredDate || null,
    canceled_date: item.canceledDate || null,
  };
}

export async function updateOrderItem(itemId: number, payload: OrderItemPayload) {
  return supabase.from("order_items").update(payload).eq("id", itemId);
}

export async function createOrderItem(payload: OrderItemPayload) {
  return supabase.from("order_items").insert(payload);
}

export async function deleteOrderById(orderId: number) {
  return supabase.from("orders_v2").delete().eq("id", orderId);
}

export async function deleteItemsByOrderId(orderId: number) {
  return supabase.from("order_items").delete().eq("order_id", orderId);
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
