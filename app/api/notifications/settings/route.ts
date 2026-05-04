import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getDefaultNotificationSettings,
  isKnownNotificationEventType,
  isKnownNotificationRole,
  type NotificationSetting,
} from "../../../../lib/notifications/settings";

type NotificationSettingsRow = {
  event_type: string;
  role: string;
  push_enabled: boolean | null;
  email_enabled: boolean | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
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

function isMissingSettingsTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.message?.toLowerCase().includes("notification_settings") ||
    error?.message?.toLowerCase().includes("does not exist")
  );
}

async function requireAdmin(
  request: Request
): Promise<
  | { supabase: ReturnType<typeof getAdminSupabase>; response?: never }
  | { response: NextResponse; supabase?: never }
> {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = getAdminSupabase();
  const { data: userResult, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userResult.user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userResult.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase };
}

function mergeWithDefaults(rows: NotificationSettingsRow[]) {
  const stored = new Map(
    rows
      .filter(
        (row) =>
          isKnownNotificationEventType(row.event_type) &&
          isKnownNotificationRole(row.role)
      )
      .map((row) => [
        `${row.event_type}:${row.role}`,
        {
          eventType: row.event_type,
          role: row.role,
          pushEnabled: Boolean(row.push_enabled),
          emailEnabled: Boolean(row.email_enabled),
        } as NotificationSetting,
      ])
  );

  return getDefaultNotificationSettings().map(
    (setting) => stored.get(`${setting.eventType}:${setting.role}`) || setting
  );
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const { data, error } = await auth.supabase
    .from("notification_settings")
    .select("event_type, role, push_enabled, email_enabled");

  if (error) {
    if (isMissingSettingsTable(error)) {
      return NextResponse.json({
        settings: getDefaultNotificationSettings(),
        tableMissing: true,
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: mergeWithDefaults((data || []) as NotificationSettingsRow[]),
    tableMissing: false,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    settings?: NotificationSetting[];
  };

  const settings = (body.settings || []).filter(
    (setting) =>
      isKnownNotificationEventType(setting.eventType) &&
      isKnownNotificationRole(setting.role)
  );

  if (settings.length === 0) {
    return NextResponse.json({ error: "Missing settings" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("notification_settings").upsert(
    settings.map((setting) => ({
      event_type: setting.eventType,
      role: setting.role,
      push_enabled: setting.pushEnabled,
      email_enabled: setting.emailEnabled,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "event_type,role" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
