import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDefaultNotificationSetting,
  isKnownNotificationEventType,
  isKnownNotificationRole,
  type NotificationChannel,
  type NotificationEventType,
  type NotificationRecipientRole,
} from "./settings";

type NotificationSettingsRow = {
  event_type: string;
  role: string;
  push_enabled: boolean | null;
  email_enabled: boolean | null;
};

function isMissingSettingsTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.message?.toLowerCase().includes("notification_settings") ||
    error?.message?.toLowerCase().includes("does not exist")
  );
}

function normalizeEventType(value: string): NotificationEventType | null {
  return isKnownNotificationEventType(value) ? value : null;
}

function normalizeRole(value: string): NotificationRecipientRole | null {
  return isKnownNotificationRole(value) ? value : null;
}

export async function filterRecipientRolesForEvent(
  supabase: SupabaseClient,
  eventType: string,
  roles: Array<Exclude<NotificationRecipientRole, "viewer">>
) {
  const normalizedEventType = normalizeEventType(eventType);
  if (!normalizedEventType || roles.length === 0) return roles;

  const { data, error } = await supabase
    .from("notification_settings")
    .select("event_type, role, push_enabled, email_enabled")
    .eq("event_type", normalizedEventType)
    .in("role", roles);

  if (error) {
    if (isMissingSettingsTable(error)) return roles;
    throw error;
  }

  const rows = ((data || []) as NotificationSettingsRow[]).filter((row) =>
    normalizeRole(row.role)
  );

  return roles.filter((role) => {
    const row = rows.find((setting) => setting.role === role);
    const setting = row
      ? {
          pushEnabled: Boolean(row.push_enabled),
          emailEnabled: Boolean(row.email_enabled),
        }
      : getDefaultNotificationSetting(normalizedEventType, role);

    return setting.pushEnabled || setting.emailEnabled;
  });
}

export async function isNotificationChannelEnabled(
  supabase: SupabaseClient,
  params: {
    eventType: string;
    role: string | null | undefined;
    channel: NotificationChannel;
  }
) {
  const eventType = normalizeEventType(params.eventType);
  const role = params.role ? normalizeRole(params.role) : null;

  if (!eventType || !role) return true;

  const { data, error } = await supabase
    .from("notification_settings")
    .select("push_enabled, email_enabled")
    .eq("event_type", eventType)
    .eq("role", role)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTable(error)) return true;
    throw error;
  }

  const setting = data
    ? {
        pushEnabled: Boolean(data.push_enabled),
        emailEnabled: Boolean(data.email_enabled),
      }
    : getDefaultNotificationSetting(eventType, role);

  return params.channel === "push" ? setting.pushEnabled : setting.emailEnabled;
}
