import { createClient } from "@supabase/supabase-js";
import { dispatchNotificationEventPush } from "./push-server";

type NotificationRecipientRole = "admin" | "supplier" | "buyer";
type NotificationEventType =
  | "new_order"
  | "overdue"
  | "status_changed"
  | "cancellation";

type NotificationEventDraft = {
  eventKey: string;
  eventType: NotificationEventType;
  orderId: number | null;
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

async function fetchProfilesByRoles(roles: NotificationRecipientRole[]) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .in("role", roles);

  if (error || !data) {
    throw error || new Error("Не удалось загрузить получателей уведомлений.");
  }

  return data as Array<{ id: string; role: NotificationRecipientRole }>;
}

export async function createNotificationEvents(events: NotificationEventDraft[]) {
  const supabase = getAdminSupabase();

  for (const event of events) {
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

    const recipients = await fetchProfilesByRoles(event.recipientRoles);

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

    await dispatchNotificationEventPush(insertedEvent.id);
  }
}

export type { NotificationEventDraft, NotificationEventType, NotificationRecipientRole };
