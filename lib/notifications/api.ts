"use client";

import { supabase } from "../supabase";
import type { OrderItem, OrderWithItems, UserProfile } from "../orders/types";
import { isOrderOverdue } from "../orders/utils";

type NotificationRecipientRole = "admin" | "supplier" | "buyer";
type NotificationEventType =
  | "new_order"
  | "overdue"
  | "status_changed"
  | "cancellation";

type NotificationEventRow = {
  id: string;
  event_type: NotificationEventType;
  event_key: string;
  order_id: number | null;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type NotificationRecipientRow = {
  id: number;
  user_id: string;
  delivered_at: string | null;
  seen_at: string | null;
  event_id: string;
  notification_events: NotificationEventRow | null;
};

function normalizeNotificationRecipientRow(row: {
  id: number;
  user_id: string;
  delivered_at: string | null;
  seen_at: string | null;
  event_id: string;
  notification_events:
    | NotificationEventRow
    | NotificationEventRow[]
    | null
    | undefined;
}): NotificationRecipientRow {
  const eventValue = Array.isArray(row.notification_events)
    ? row.notification_events[0] || null
    : row.notification_events || null;

  return {
    id: row.id,
    user_id: row.user_id,
    delivered_at: row.delivered_at,
    seen_at: row.seen_at,
    event_id: row.event_id,
    notification_events: eventValue,
  };
}

function getOrderLabel(order: Pick<OrderWithItems, "id" | "client_order">) {
  return (order.client_order || "").trim() || `Заказ #${order.id}`;
}

function pluralizeRu(
  count: number,
  forms: [one: string, few: string, many: string]
) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

async function createEventAndRecipients(
  events: Array<{
    eventKey: string;
    eventType: NotificationEventType;
    orderId: number | null;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    recipientRoles: NotificationRecipientRole[];
  }>
) {
  const response = await fetch("/api/notifications/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      events,
    }),
  }).catch(() => null);

  if (!response || !response.ok) {
    throw new Error("Не удалось создать уведомления на сервере.");
  }
}

export async function notifyNewOrderCreated(params: {
  orderId: number;
  clientOrder: string;
}) {
  const orderLabel = params.clientOrder.trim() || `#${params.orderId}`;

  await createEventAndRecipients([
    {
      eventKey: `new-order:${params.orderId}`,
      eventType: "new_order",
      orderId: params.orderId,
      title: "Новый заказ",
      body: `Появился новый заказ ${orderLabel}.`,
      payload: {
        clientOrder: params.clientOrder,
        url: `/orders/${params.orderId}`,
      },
      recipientRoles: ["admin", "supplier", "buyer"],
    },
  ]);
}

export async function ensureOverdueNotificationEvents(orders: OrderWithItems[]) {
  const overdueOrders = orders.filter((order) => isOrderOverdue(order.order_items || []));

  if (overdueOrders.length === 0) return;

  await createEventAndRecipients(
    overdueOrders.map((order) => ({
        eventKey: `overdue:${order.id}`,
        eventType: "overdue",
        orderId: order.id,
        title: "Просрочка по заказу",
        body: `${getOrderLabel(order)} требует внимания: есть просроченные позиции.`,
        payload: {
          clientOrder: order.client_order || "",
          url: `/orders/${order.id}`,
        },
        recipientRoles: ["admin", "supplier", "buyer"],
      }))
  );
}

function getStatusDiff(beforeItems: OrderItem[], afterItems: OrderItem[]) {
  const beforeById = new Map(beforeItems.map((item) => [item.id, item]));
  let changedCount = 0;
  let canceledCount = 0;
  let nonCancellationChangedCount = 0;

  for (const item of afterItems) {
    const beforeItem = beforeById.get(item.id);
    const beforeStatus = beforeItem?.status || "Новый";
    const afterStatus = item.status || "Новый";
    const becameCanceled = beforeStatus !== "Отменен" && afterStatus === "Отменен";

    if (beforeStatus !== afterStatus) {
      changedCount += 1;
    }

    if (becameCanceled) {
      canceledCount += 1;
    } else if (beforeStatus !== afterStatus) {
      nonCancellationChangedCount += 1;
    }
  }

  return {
    changedCount,
    canceledCount,
    nonCancellationChangedCount,
  };
}

export async function notifyOrderChanged(params: {
  beforeOrder: OrderWithItems;
  afterOrder: Pick<OrderWithItems, "id" | "client_order"> & { order_items?: OrderItem[] };
  updatedAtKey: string;
}) {
  const beforeItems = params.beforeOrder.order_items || [];
  const afterItems = params.afterOrder.order_items || [];
  const { canceledCount, nonCancellationChangedCount } = getStatusDiff(beforeItems, afterItems);

  const events: Array<{
    eventKey: string;
    eventType: NotificationEventType;
    orderId: number | null;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    recipientRoles: NotificationRecipientRole[];
  }> = [];

  if (nonCancellationChangedCount > 0) {
    const statusLabel = pluralizeRu(nonCancellationChangedCount, [
      "позиции",
      "позиций",
      "позиций",
    ]);

    events.push({
        eventKey: `status-change:${params.afterOrder.id}:${params.updatedAtKey}:${nonCancellationChangedCount}`,
        eventType: "status_changed",
        orderId: params.afterOrder.id,
        title: "Статус обновлён",
        body: `В заказе ${getOrderLabel(params.afterOrder)} изменён статус ${nonCancellationChangedCount} ${statusLabel}.`,
        payload: {
          clientOrder: params.afterOrder.client_order || "",
          changedCount: nonCancellationChangedCount,
          url: `/orders/${params.afterOrder.id}`,
        },
        recipientRoles: ["admin", "buyer"],
      });
  }

  if (canceledCount > 0) {
    const canceledLabel = pluralizeRu(canceledCount, [
      "позиции",
      "позиций",
      "позиций",
    ]);

    events.push({
        eventKey: `cancellation:${params.afterOrder.id}:${params.updatedAtKey}:${canceledCount}`,
        eventType: "cancellation",
        orderId: params.afterOrder.id,
        title: "Появилась отмена",
        body: `В заказе ${getOrderLabel(params.afterOrder)} появил${canceledCount === 1 ? "ась" : "ись"} отмен${canceledCount === 1 ? "а" : "ы"} у ${canceledCount} ${canceledLabel}.`,
        payload: {
          clientOrder: params.afterOrder.client_order || "",
          canceledCount,
          url: `/orders/${params.afterOrder.id}`,
        },
        recipientRoles: ["admin", "buyer"],
      });
  }

  if (events.length > 0) {
    await createEventAndRecipients(events);
  }
}

export async function fetchPendingNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notification_recipients")
    .select(
      "id, user_id, delivered_at, seen_at, event_id, notification_events(id, event_type, event_key, order_id, title, body, payload, created_at)"
    )
    .eq("user_id", userId)
    .is("delivered_at", null)
    .order("created_at", { foreignTable: "notification_events", ascending: false });

  if (error) {
    throw error;
  }

  return ((data || []) as Array<{
    id: number;
    user_id: string;
    delivered_at: string | null;
    seen_at: string | null;
    event_id: string;
    notification_events: NotificationEventRow[] | NotificationEventRow | null;
  }>).map(normalizeNotificationRecipientRow);
}

export async function fetchNotificationRecipientById(recipientId: number) {
  const { data, error } = await supabase
    .from("notification_recipients")
    .select(
      "id, user_id, delivered_at, seen_at, event_id, notification_events(id, event_type, event_key, order_id, title, body, payload, created_at)"
    )
    .eq("id", recipientId)
    .single();

  if (error) {
    throw error;
  }

  return normalizeNotificationRecipientRow(
    data as {
      id: number;
      user_id: string;
      delivered_at: string | null;
      seen_at: string | null;
      event_id: string;
      notification_events: NotificationEventRow[] | NotificationEventRow | null;
    }
  );
}

export async function markNotificationDelivered(recipientId: number) {
  const { error } = await supabase
    .from("notification_recipients")
    .update({
      delivered_at: new Date().toISOString(),
    })
    .eq("id", recipientId);

  if (error) {
    throw error;
  }
}

export async function markNotificationSeen(recipientId: number) {
  const { error } = await supabase
    .from("notification_recipients")
    .update({
      seen_at: new Date().toISOString(),
    })
    .eq("id", recipientId);

  if (error) {
    throw error;
  }
}

export type { NotificationRecipientRow, UserProfile };
