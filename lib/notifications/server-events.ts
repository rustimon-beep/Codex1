import { createClient } from "@supabase/supabase-js";
import { dispatchNotificationEventEmail } from "./email-server";
import { dispatchNotificationEventPush } from "./push-server";
import { filterRecipientRolesForEvent } from "./settings-server";

type NotificationRecipientRole = "admin" | "supplier" | "buyer";
type NotificationEventType =
  | "new_order"
  | "overdue"
  | "status_changed"
  | "cancellation"
  | "planned_date_changed"
  | "replacement_set";

type NotificationEventDraft = {
  eventKey: string;
  eventType: NotificationEventType;
  orderId: number | null;
  supplierId?: number | null;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  recipientRoles: NotificationRecipientRole[];
};

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

async function fetchProfilesByRoles(
  roles: NotificationRecipientRole[],
  supplierId?: number | null
) {
  const supabase = getAdminSupabase();

  const primary = await supabase
    .from("profiles")
    .select("id, role, supplier_id")
    .in("role", roles);

  if (primary.error || !primary.data) {
    const fallback = await supabase.from("profiles").select("id, role").in("role", roles);

    if (fallback.error || !fallback.data) {
      throw primary.error || fallback.error || new Error("Не удалось загрузить получателей уведомлений.");
    }

    return (fallback.data as Array<{
      id: string;
      role: NotificationRecipientRole;
    }>).filter((profile) => profile.role !== "supplier");
  }

  return (primary.data as Array<{
    id: string;
    role: NotificationRecipientRole;
    supplier_id: number | null;
  }>).filter((profile) => {
    if (profile.role !== "supplier") return true;
    if (!roles.includes("supplier")) return false;
    if (!supplierId) return false;
    return profile.supplier_id === supplierId;
  });
}

export async function createNotificationEvents(events: NotificationEventDraft[]) {
  const supabase = getAdminSupabase();

  for (const event of events) {
    if (event.eventType === "overdue" || event.eventType === "new_order") {
      const { data: existingEvent } = await supabase
        .from("notification_events")
        .select("id")
        .eq("event_key", event.eventKey)
        .maybeSingle();

      if (existingEvent?.id) {
        continue;
      }
    }

    const { data: insertedEvent, error: eventError } = await supabase
      .from("notification_events")
      .upsert(
        {
          event_key: event.eventKey,
          event_type: event.eventType,
          order_id: event.orderId,
          title: event.title,
          body: event.body,
          payload: event.payload || {},
        },
        { onConflict: "event_key" }
      )
      .select("id")
      .single();

    if (eventError || !insertedEvent?.id) {
      throw eventError || new Error("Не удалось создать событие уведомления.");
    }

    const enabledRecipientRoles = await filterRecipientRolesForEvent(
      supabase,
      event.eventType,
      event.recipientRoles
    );
    const recipients = await fetchProfilesByRoles(enabledRecipientRoles, event.supplierId);
    if (event.recipientRoles.includes("supplier")) {
      const { error: staleSupplierRecipientsError } = await supabase
        .from("notification_recipients")
        .delete()
        .eq("event_id", insertedEvent.id)
        .eq("role", "supplier");

      if (staleSupplierRecipientsError) {
        throw staleSupplierRecipientsError;
      }
    }

    if (recipients.length > 0) {
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
    }

    const dispatchResults = await Promise.allSettled([
      dispatchNotificationEventPush(insertedEvent.id),
      dispatchNotificationEventEmail(insertedEvent.id),
    ]);

    for (const result of dispatchResults) {
      if (result.status === "rejected") {
        console.error("Notification dispatch failed", {
          eventId: insertedEvent.id,
          eventKey: event.eventKey,
          eventType: event.eventType,
          message:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    }
  }
}

export async function createOverdueNotificationEventsForOrders(
  orders: Array<{ id: number; client_order: string | null; supplier_id: number | null }>
) {
  if (orders.length === 0) return;

  await createNotificationEvents(
    orders.map((order) => ({
      eventKey: `overdue:${order.id}`,
      eventType: "overdue" as const,
      orderId: order.id,
      supplierId: order.supplier_id,
      title: "Просроченный заказ",
      body: `Заказ просрочен: ${(order.client_order || "").trim() || `#${order.id}`}.`,
      payload: {
        clientOrder: order.client_order || "",
        url: `/orders/${order.id}`,
      },
      recipientRoles: ["admin", "supplier", "buyer"],
    }))
  );
}

export async function registerFirstOverdueItems(
  items: Array<{
    order_item_id: number;
    order_id: number;
    supplier_id: number | null;
    first_planned_date: string | null;
  }>
) {
  if (items.length === 0) return [];

  const supabase = getAdminSupabase();
  const itemIds = items.map((item) => item.order_item_id);

  const { data: existingRows, error: existingError } = await supabase
    .from("order_item_first_overdue")
    .select("order_item_id")
    .in("order_item_id", itemIds);

  if (existingError) {
    throw existingError;
  }

  const existingIds = new Set((existingRows || []).map((row) => row.order_item_id as number));
  const freshItems = items.filter((item) => !existingIds.has(item.order_item_id));

  if (freshItems.length === 0) return [];

  const { error } = await supabase.from("order_item_first_overdue").insert(
    freshItems.map((item) => ({
      order_item_id: item.order_item_id,
      order_id: item.order_id,
      supplier_id: item.supplier_id,
      first_planned_date: item.first_planned_date,
    }))
  );

  if (error) {
    throw error;
  }

  return freshItems;
}

export type { NotificationEventDraft, NotificationEventType, NotificationRecipientRole };
