"use client";

import { supabase } from "../supabase";
import type { OrderItem, OrderWithItems, UserProfile } from "../orders/types";
import { getOrderStatus, isOrderOverdue } from "../orders/utils";

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

async function fetchProfilesByRoles(roles: NotificationRecipientRole[]) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .in("role", roles);

  if (error || !data) {
    throw error || new Error("Не удалось загрузить получателей уведомлений.");
  }

  return data as Array<{ id: string; role: NotificationRecipientRole }>;
}

async function createEventAndRecipients(params: {
  eventKey: string;
  eventType: NotificationEventType;
  orderId: number | null;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  recipientRoles: NotificationRecipientRole[];
}) {
  const { data: insertedEvent, error: eventError } = await supabase
    .from("notification_events")
    .upsert(
      {
        event_key: params.eventKey,
        event_type: params.eventType,
        order_id: params.orderId,
        title: params.title,
        body: params.body,
        payload: params.payload || {},
      },
      { onConflict: "event_key" }
    )
    .select("id")
    .single();

  if (eventError || !insertedEvent?.id) {
    throw eventError || new Error("Не удалось создать событие уведомления.");
  }

  const recipients = await fetchProfilesByRoles(params.recipientRoles);

  if (recipients.length === 0) return;

  const { error: recipientsError } = await supabase
    .from("notification_recipients")
    .upsert(
      recipients.map((recipient) => ({
        event_id: insertedEvent.id,
        user_id: recipient.id,
        role: recipient.role,
      })),
      { onConflict: "event_id,user_id" }
    );

  if (recipientsError) {
    throw recipientsError;
  }

  await fetch("/api/notifications/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId: insertedEvent.id,
    }),
  }).catch(() => {});
}

export async function notifyNewOrderCreated(params: {
  orderId: number;
  clientOrder: string;
}) {
  await createEventAndRecipients({
    eventKey: `new-order:${params.orderId}`,
    eventType: "new_order",
    orderId: params.orderId,
    title: "Новый заказ",
    body: `Появился новый заказ: ${params.clientOrder || `#${params.orderId}`}.`,
    payload: {
      clientOrder: params.clientOrder,
    },
    recipientRoles: ["admin", "supplier", "buyer"],
  });
}

export async function ensureOverdueNotificationEvents(orders: OrderWithItems[]) {
  const overdueOrders = orders.filter((order) => isOrderOverdue(order.order_items || []));

  await Promise.all(
    overdueOrders.map((order) =>
      createEventAndRecipients({
        eventKey: `overdue:${order.id}`,
        eventType: "overdue",
        orderId: order.id,
        title: "Просроченный заказ",
        body: `Заказ просрочен: ${getOrderLabel(order)}.`,
        payload: {
          clientOrder: order.client_order || "",
        },
        recipientRoles: ["admin", "supplier", "buyer"],
      })
    )
  );
}

function getStatusDiff(beforeItems: OrderItem[], afterItems: OrderItem[]) {
  const beforeById = new Map(beforeItems.map((item) => [item.id, item]));
  let changedCount = 0;
  let canceledCount = 0;

  for (const item of afterItems) {
    const beforeItem = beforeById.get(item.id);
    const beforeStatus = beforeItem?.status || "Новый";
    const afterStatus = item.status || "Новый";

    if (beforeStatus !== afterStatus) {
      changedCount += 1;
    }

    if (beforeStatus !== "Отменен" && afterStatus === "Отменен") {
      canceledCount += 1;
    }
  }

  return {
    changedCount,
    canceledCount,
  };
}

export async function notifyOrderChanged(params: {
  beforeOrder: OrderWithItems;
  afterOrder: Pick<OrderWithItems, "id" | "client_order"> & { order_items?: OrderItem[] };
  updatedAtKey: string;
}) {
  const beforeItems = params.beforeOrder.order_items || [];
  const afterItems = params.afterOrder.order_items || [];
  const { changedCount, canceledCount } = getStatusDiff(beforeItems, afterItems);

  const tasks: Promise<void>[] = [];

  if (changedCount > 0) {
    tasks.push(
      createEventAndRecipients({
        eventKey: `status-change:${params.afterOrder.id}:${params.updatedAtKey}:${changedCount}`,
        eventType: "status_changed",
        orderId: params.afterOrder.id,
        title: "Изменение статуса",
        body: `В заказе ${getOrderLabel(params.afterOrder)} изменены статусы позиций: ${changedCount}.`,
        payload: {
          clientOrder: params.afterOrder.client_order || "",
          changedCount,
        },
        recipientRoles: ["admin", "buyer"],
      })
    );
  }

  if (canceledCount > 0) {
    tasks.push(
      createEventAndRecipients({
        eventKey: `cancellation:${params.afterOrder.id}:${params.updatedAtKey}:${canceledCount}`,
        eventType: "cancellation",
        orderId: params.afterOrder.id,
        title: "Есть отмены",
        body: `В заказе ${getOrderLabel(params.afterOrder)} появились отменённые позиции: ${canceledCount}.`,
        payload: {
          clientOrder: params.afterOrder.client_order || "",
          canceledCount,
        },
        recipientRoles: ["admin", "buyer"],
      })
    );
  }

  await Promise.all(tasks);
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
