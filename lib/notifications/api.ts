"use client";

import { supabase } from "../supabase";
import type { OrderItem, OrderWithItems, UserProfile } from "../orders/types";

type NotificationRecipientRole = "admin" | "supplier" | "buyer";
type NotificationEventType =
  | "new_order"
  | "overdue"
  | "status_changed"
  | "cancellation"
  | "planned_date_changed";

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

function formatIsoDate(value: string | null | undefined) {
  const safe = (value || "").slice(0, 10);
  if (!safe) return "—";
  const [year, month, day] = safe.split("-");
  if (!year || !month || !day) return safe;
  return `${day}.${month}.${year}`;
}

async function createEventAndRecipients(
  events: Array<{
    eventKey: string;
    eventType: NotificationEventType;
    orderId: number | null;
    supplierId?: number | null;
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
  supplierId: number | null;
}) {
  const orderLabel = params.clientOrder.trim() || `#${params.orderId}`;

  await createEventAndRecipients([
    {
      eventKey: `new-order:${params.orderId}`,
      eventType: "new_order",
      orderId: params.orderId,
      supplierId: params.supplierId,
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

export async function ensureOverdueNotificationEvents(_orders: OrderWithItems[]) {
  await fetch("/api/notifications/overdue-scan", {
    method: "POST",
  }).catch(() => null);
}

function getStatusDiff(beforeItems: OrderItem[], afterItems: OrderItem[]) {
  const beforeById = new Map(beforeItems.map((item) => [item.id, item]));
  let changedCount = 0;
  let canceledCount = 0;
  let nonCancellationChangedCount = 0;
  let plannedDateChangedCount = 0;
  let singleCancellationChange:
    | {
        article: string | null;
        name: string | null;
      }
    | null = null;
  let singleStatusChange:
    | {
        beforeStatus: string;
        afterStatus: string;
        article: string | null;
        name: string | null;
      }
    | null = null;
  let singlePlannedDateChange:
    | { before: string | null; after: string | null; article: string | null; name: string | null }
    | null = null;

  for (const item of afterItems) {
    const beforeItem = beforeById.get(item.id);
    const beforeStatus = beforeItem?.status || "Новый";
    const afterStatus = item.status || "Новый";
    const beforePlannedDate = (beforeItem?.planned_date || "").slice(0, 10);
    const afterPlannedDate = (item.planned_date || "").slice(0, 10);
    const becameCanceled = beforeStatus !== "Отменен" && afterStatus === "Отменен";

    if (beforeStatus !== afterStatus) {
      changedCount += 1;
      if (!becameCanceled) {
        if (nonCancellationChangedCount === 0) {
          singleStatusChange = {
            beforeStatus,
            afterStatus,
            article: item.article || beforeItem?.article || null,
            name: item.name || beforeItem?.name || null,
          };
        } else {
          singleStatusChange = null;
        }
      }
    }

    if (beforePlannedDate !== afterPlannedDate) {
      plannedDateChangedCount += 1;
      if (plannedDateChangedCount === 1) {
        singlePlannedDateChange = {
          before: beforeItem?.planned_date || null,
          after: item.planned_date || null,
          article: item.article || beforeItem?.article || null,
          name: item.name || beforeItem?.name || null,
        };
      } else {
        singlePlannedDateChange = null;
      }
    }

    if (becameCanceled) {
      canceledCount += 1;
      if (canceledCount === 1) {
        singleCancellationChange = {
          article: item.article || beforeItem?.article || null,
          name: item.name || beforeItem?.name || null,
        };
      } else {
        singleCancellationChange = null;
      }
    } else if (beforeStatus !== afterStatus) {
      nonCancellationChangedCount += 1;
    }
  }

  return {
    changedCount,
    canceledCount,
    singleCancellationChange,
    nonCancellationChangedCount,
    singleStatusChange,
    plannedDateChangedCount,
    singlePlannedDateChange,
  };
}

export async function notifyOrderChanged(params: {
  beforeOrder: OrderWithItems;
  afterOrder: Pick<OrderWithItems, "id" | "client_order" | "supplier_id"> & {
    order_items?: OrderItem[];
  };
  updatedAtKey: string;
}) {
  const beforeItems = params.beforeOrder.order_items || [];
  const afterItems = params.afterOrder.order_items || [];
  const {
    canceledCount,
    singleCancellationChange,
    nonCancellationChangedCount,
    singleStatusChange,
    plannedDateChangedCount,
    singlePlannedDateChange,
  } = getStatusDiff(beforeItems, afterItems);

  const events: Array<{
    eventKey: string;
    eventType: NotificationEventType;
    orderId: number | null;
    supplierId?: number | null;
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
    const singleLineLabel =
      singleStatusChange &&
      [singleStatusChange.article, singleStatusChange.name].filter(Boolean).join(" · ");

    events.push({
        eventKey: `status-change:${params.afterOrder.id}:${params.updatedAtKey}:${nonCancellationChangedCount}`,
        eventType: "status_changed",
        orderId: params.afterOrder.id,
        title: "Статус обновлён",
        body:
          nonCancellationChangedCount === 1 && singleStatusChange
            ? `В заказе ${getOrderLabel(params.afterOrder)} изменён статус: ${
                singleStatusChange.beforeStatus
              } → ${singleStatusChange.afterStatus}${
                singleLineLabel ? ` (${singleLineLabel})` : ""
              }.`
            : `В заказе ${getOrderLabel(params.afterOrder)} изменён статус ${nonCancellationChangedCount} ${statusLabel}.`,
        payload: {
          clientOrder: params.afterOrder.client_order || "",
          changedCount: nonCancellationChangedCount,
          previousStatus:
            nonCancellationChangedCount === 1 ? singleStatusChange?.beforeStatus || "" : "",
          nextStatus:
            nonCancellationChangedCount === 1 ? singleStatusChange?.afterStatus || "" : "",
          lineLabel: nonCancellationChangedCount === 1 ? singleLineLabel || "" : "",
          url: `/orders/${params.afterOrder.id}`,
        },
        recipientRoles: ["admin", "buyer"],
      });
  }

  if (plannedDateChangedCount > 0) {
    const dateLabel = pluralizeRu(plannedDateChangedCount, [
      "позиции",
      "позиций",
      "позиций",
    ]);
    const singleLineLabel =
      singlePlannedDateChange &&
      [singlePlannedDateChange.article, singlePlannedDateChange.name]
        .filter(Boolean)
        .join(" · ");

    events.push({
      eventKey: `planned-date-change:${params.afterOrder.id}:${params.updatedAtKey}:${plannedDateChangedCount}`,
      eventType: "planned_date_changed",
      orderId: params.afterOrder.id,
      title: "Плановая дата изменена",
      body:
        plannedDateChangedCount === 1 && singlePlannedDateChange
          ? `В заказе ${getOrderLabel(params.afterOrder)} изменена плановая дата: ${formatIsoDate(
              singlePlannedDateChange.before
            )} → ${formatIsoDate(singlePlannedDateChange.after)}${
              singleLineLabel ? ` (${singleLineLabel})` : ""
            }.`
          : `В заказе ${getOrderLabel(params.afterOrder)} изменена плановая дата у ${plannedDateChangedCount} ${dateLabel}.`,
      payload: {
        clientOrder: params.afterOrder.client_order || "",
        changedCount: plannedDateChangedCount,
        previousDate:
          plannedDateChangedCount === 1 ? singlePlannedDateChange?.before || null : null,
        nextDate:
          plannedDateChangedCount === 1 ? singlePlannedDateChange?.after || null : null,
        lineLabel: plannedDateChangedCount === 1 ? singleLineLabel || "" : "",
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
    const singleLineLabel =
      singleCancellationChange &&
      [singleCancellationChange.article, singleCancellationChange.name]
        .filter(Boolean)
        .join(" · ");

    events.push({
        eventKey: `cancellation:${params.afterOrder.id}:${params.updatedAtKey}:${canceledCount}`,
        eventType: "cancellation",
        orderId: params.afterOrder.id,
        title: "Появилась отмена",
        body:
          canceledCount === 1 && singleCancellationChange
            ? `В заказе ${getOrderLabel(params.afterOrder)} появилась отмена${
                singleLineLabel ? ` (${singleLineLabel})` : ""
              }.`
            : `В заказе ${getOrderLabel(params.afterOrder)} появил${canceledCount === 1 ? "ась" : "ись"} отмен${canceledCount === 1 ? "а" : "ы"} у ${canceledCount} ${canceledLabel}.`,
        payload: {
          clientOrder: params.afterOrder.client_order || "",
          canceledCount,
          lineLabel: canceledCount === 1 ? singleLineLabel || "" : "",
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
