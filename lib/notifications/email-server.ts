import { createClient } from "@supabase/supabase-js";

type EmailDispatchRow = {
  id: number;
  user_id: string;
  emailed_at: string | null;
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
  profiles:
    | {
        email: string | null;
        full_name: string | null;
      }
    | Array<{
        email: string | null;
        full_name: string | null;
      }>
    | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function isEmailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM &&
      process.env.NEXT_PUBLIC_APP_URL
  );
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

function getSingle<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function stripTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailContent(params: {
  title: string;
  body: string;
  url: string;
  recipientName?: string | null;
}) {
  const safeTitle = escapeHtml(params.title);
  const safeBody = escapeHtml(params.body);
  const safeUrl = escapeHtml(params.url);
  const safeRecipient = params.recipientName
    ? `<p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:22px;">${escapeHtml(
        params.recipientName
      )},</p>`
    : "";

  return {
    subject: params.title,
    html: `
      <div style="background:#f5f7fa;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;padding:32px;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;font-weight:700;margin-bottom:12px;">
            Автодом
          </div>
          <h1 style="margin:0 0 16px;color:#0f172a;font-size:26px;line-height:32px;font-weight:700;">${safeTitle}</h1>
          ${safeRecipient}
          <p style="margin:0;color:#475569;font-size:15px;line-height:26px;">${safeBody}</p>
          <div style="margin-top:24px;">
            <a href="${safeUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:14px;font-size:14px;font-weight:700;">
              Открыть заказ
            </a>
          </div>
          <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:20px;">
            Это автоматическое письмо из системы обработки и мониторинга заказов Автодом.
          </p>
        </div>
      </div>
    `,
    text: `${params.title}\n\n${params.body}\n\nОткрыть заказ: ${params.url}`,
  };
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getRequiredEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getRequiredEnv("EMAIL_FROM"),
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend email failed: ${response.status} ${body}`.trim());
  }
}

export async function dispatchNotificationEventEmail(eventId: string) {
  if (!isEmailConfigured()) return;

  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("notification_recipients")
    .select(
      "id, user_id, emailed_at, notification_events(id, title, body, order_id, event_type, event_key, payload), profiles(email, full_name)"
    )
    .eq("event_id", eventId)
    .is("emailed_at", null);

  if (error) {
    throw error;
  }

  const appUrl = stripTrailingSlash(getRequiredEnv("NEXT_PUBLIC_APP_URL"));

  for (const row of (data || []) as EmailDispatchRow[]) {
    const eventValue = getSingle(row.notification_events);
    const profileValue = getSingle(row.profiles);
    const email = (profileValue?.email || "").trim();

    if (!eventValue?.title || !eventValue?.body || !email) {
      continue;
    }

    const relativeUrl =
      typeof eventValue.payload?.url === "string"
        ? eventValue.payload.url
        : eventValue.order_id
          ? `/orders/${eventValue.order_id}`
          : "/";
    const absoluteUrl = `${appUrl}${relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`}`;
    const content = buildEmailContent({
      title: eventValue.title,
      body: eventValue.body,
      url: absoluteUrl,
      recipientName: profileValue?.full_name || null,
    });

    await sendEmail({
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    await supabase
      .from("notification_recipients")
      .update({
        emailed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}
