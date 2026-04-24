import { supabase } from "../supabase";
import type { ItemForm, OrderWithItems } from "./types";

type OrderHeaderPayload = {
  client_order: string;
  order_date: string;
  order_type: string;
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

export async function fetchOrders() {
  return supabase
    .from("orders_v2")
    .select("*, order_items(*)")
    .order("id", { ascending: false });
}

export async function fetchOrderById(orderId: number) {
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
