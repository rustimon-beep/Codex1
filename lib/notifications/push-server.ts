import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { isNotificationChannelEnabled } from "./settings-server";

type PushSubscriptionRow = {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
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

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:notify@example.com",
    getRequiredEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
    getRequiredEnv("VAPID_PRIVATE_KEY")
  );
}

function getPushPresentation(eventType: string, eventKey: string) {
  return {
    tag: `avtodom-${eventKey}`,
    requireInteraction: eventType === "overdue" || eventType === "cancellation",
  };
}

export async function dispatchNotificationEventPush(eventId: string) {
  configureWebPush();

  const supabase = getAdminSupabase();

  const { data: recipients, error: recipientsError } = await supabase
    .from("notification_recipients")
    .select(
      "id, user_id, role, delivered_at, notification_events(id, title, body, order_id, event_type, event_key, payload)"
    )
    .eq("event_id", eventId)
    .is("delivered_at", null);

  if (recipientsError) {
    throw recipientsError;
  }

  for (const recipient of recipients || []) {
    const eventValue = Array.isArray(recipient.notification_events)
      ? recipient.notification_events[0]
      : recipient.notification_events;

    if (!eventValue?.title || !eventValue?.body) continue;
    const channelEnabled = await isNotificationChannelEnabled(supabase, {
      eventType: eventValue.event_type,
      role: recipient.role,
      channel: "push",
    });
    if (!channelEnabled) continue;

    const url =
      typeof eventValue.payload?.url === "string"
        ? eventValue.payload.url
        : eventValue.order_id
          ? `/orders/${eventValue.order_id}`
          : "/";
    const presentation = getPushPresentation(eventValue.event_type, eventValue.event_key);

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .eq("user_id", recipient.user_id);

    if (subscriptionsError) {
      throw subscriptionsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      continue;
    }

    let delivered = false;

    for (const subscription of subscriptions as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: eventValue.title,
            body: eventValue.body,
            url,
            eventKey: eventValue.event_key,
            tag: presentation.tag,
            requireInteraction: presentation.requireInteraction,
          })
        );

        delivered = true;

        await supabase
          .from("push_subscriptions")
          .update({
            last_success_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }

    if (delivered) {
      await supabase
        .from("notification_recipients")
        .update({
          delivered_at: new Date().toISOString(),
        })
        .eq("id", recipient.id);
    }
  }
}
