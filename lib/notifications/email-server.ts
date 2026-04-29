import { createClient } from "@supabase/supabase-js";

type RecipientWithEvent = {
  id: number;
  user_id: string;
  role: string;
  emailed_at?: string | null;
  notification_events:
    | {
        id: string;
        title: string;
        body: string;
        order_id: number | null;
        event_type: string;
        event_key: string;
        payload: Record<string, unknown> | null;
      }
    | Array<{
        id: string;
        title: string;
        body: string;
        order_id: number | null;
        event_type: string;
        event_key: string;
        payload: Record<string, unknown> | null;
      }>
    | null;
};

type ProfileEmailRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string) {
  return process.env[name] || "";
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

function getMailConfig() {
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const from = getOptionalEnv("EMAIL_FROM");
  const appUrl = getOptionalEnv("NEXT_PUBLIC_APP_URL");

  if (!apiKey || !from) return null;

  return {
    apiKey,
    from,
    appUrl: appUrl.replace(/\/$/, ""),
  };
}

function resolveEventValue(recipient: RecipientWithEvent) {
  return Array.isArray(recipient.notification_events)
    ? recipient.notification_events[0] || null
    : recipient.notification_events || null;
}

function getAbsoluteUrl(path: string, appUrl: string) {
  if (!path) return appUrl || "/";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!appUrl) return path;
  return `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildEmailHtml(params: {
  title: string;
  body: string;
  recipientName?: string | null;
  eventType: string;
  url: string;
}) {
  const intro =
    params.recipientName && params.recipientName.trim()
      ? `Здравствуйте, ${params.recipientName.trim()}.`
      : "Здравствуйте.";

  const eventLabelMap: Record<string, string> = {
    new_order: "Новый заказ",
    overdue: "Нарушен первый срок поставки",
    status_changed: "Изменение статуса",
    cancellation: "Отмена позиции",
    planned_date_changed: "Изменение планового срока",
    replacement_set: "Проставлена замена",
  };

  const eventLabel = eventLabelMap[params.eventType] || "Уведомление по заказу";

  return `
    <div style="margin:0;padding:24px;background:#F5F7FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;">
      <div style="max-width:680px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
        <div style="padding:24px 28px;background:#111827;color:#FFFFFF;">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#94A3B8;">Автодом</div>
          <div style="margin-top:10px;font-size:28px;font-weight:700;line-height:1.2;">${params.title}</div>
          <div style="margin-top:8px;font-size:14px;line-height:1.6;color:#CBD5E1;">${eventLabel}</div>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;">${intro}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">${params.body}</p>
          <a href="${params.url}" style="display:inline-block;padding:12px 18px;border-radius:14px;background:#0F766E;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;">
            Открыть заказ
          </a>
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #E5E7EB;font-size:12px;line-height:1.6;color:#64748B;">
            Это служебное уведомление портала заказов Автодом.
          </div>
        </div>
      </div>
    </div>
  `;
}

async function sendViaResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Email provider returned an error.");
  }
}

export async function dispatchNotificationEventEmail(eventId: string) {
  const mailConfig = getMailConfig();
  if (!mailConfig) return;

  const supabase = getAdminSupabase();

  const { data: recipients, error: recipientsError } = await supabase
    .from("notification_recipients")
    .select(
      "id, user_id, role, emailed_at, notification_events(id, title, body, order_id, event_type, event_key, payload)"
    )
    .eq("event_id", eventId)
    .is("emailed_at", null);

  if (recipientsError) {
    throw recipientsError;
  }

  for (const recipient of (recipients || []) as RecipientWithEvent[]) {
    const eventValue = resolveEventValue(recipient);
    if (!eventValue?.title || !eventValue?.body) continue;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", recipient.user_id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const email = (profile as ProfileEmailRow | null)?.email?.trim();
    if (!email) continue;

    const rawUrl =
      typeof eventValue.payload?.url === "string"
        ? eventValue.payload.url
        : eventValue.order_id
          ? `/orders/${eventValue.order_id}`
          : "/";
    const targetUrl = getAbsoluteUrl(rawUrl, mailConfig.appUrl);

    await sendViaResend({
      apiKey: mailConfig.apiKey,
      from: mailConfig.from,
      to: email,
      subject: eventValue.title,
      html: buildEmailHtml({
        title: eventValue.title,
        body: eventValue.body,
        recipientName: (profile as ProfileEmailRow | null)?.full_name || null,
        eventType: eventValue.event_type,
        url: targetUrl,
      }),
      text: `${eventValue.title}\n\n${eventValue.body}\n\nОткрыть: ${targetUrl}`,
    });

    await supabase
      .from("notification_recipients")
      .update({
        emailed_at: new Date().toISOString(),
      })
      .eq("id", recipient.id);
  }
}
