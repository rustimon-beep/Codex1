"use client";

import { supabase } from "../supabase";

type TimelineRecipient = {
  id: number;
  userId: string;
  role: string | null;
  deliveredAt: string | null;
  seenAt: string | null;
  emailedAt: string | null;
  profileName: string | null;
  profileEmail: string | null;
};

type OrderTimelineEvent = {
  id: string;
  eventType: string;
  eventKey: string;
  title: string;
  body: string;
  createdAt: string;
  payload: Record<string, unknown> | null;
  recipients: TimelineRecipient[];
};

type NotificationEventRow = {
  id: string;
  event_type: string;
  event_key: string;
  title: string;
  body: string;
  created_at: string;
  payload: Record<string, unknown> | null;
};

type NotificationRecipientRow = {
  id: number;
  user_id: string;
  role?: string | null;
  delivered_at: string | null;
  seen_at: string | null;
  emailed_at?: string | null;
  event_id: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name?: string | null;
};

async function fetchRecipients(eventIds: string[]) {
  const primary = await supabase
    .from("notification_recipients")
    .select("id, user_id, role, delivered_at, seen_at, emailed_at, event_id")
    .in("event_id", eventIds);

  if (!primary.error) {
    return (primary.data || []) as NotificationRecipientRow[];
  }

  const fallback = await supabase
    .from("notification_recipients")
    .select("id, user_id, role, delivered_at, seen_at, event_id")
    .in("event_id", eventIds);

  if (!fallback.error) {
    return ((fallback.data || []) as NotificationRecipientRow[]).map((row) => ({
      ...row,
      emailed_at: null,
    }));
  }

  console.warn("Не удалось загрузить получателей уведомлений", primary.error || fallback.error);
  return [];
}

async function fetchProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  if (error) {
    console.warn("Не удалось загрузить профили получателей", error);
    return new Map<string, ProfileRow>();
  }

  return new Map((data || []).map((profile) => [profile.id, profile as ProfileRow]));
}

export async function fetchOrderNotificationTimeline(orderId: number) {
  const { data, error } = await supabase
    .from("notification_events")
    .select("id, event_type, event_key, title, body, payload, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    throw error;
  }

  const events = (data || []) as NotificationEventRow[];
  const eventIds = events.map((event) => event.id);
  const recipients = eventIds.length > 0 ? await fetchRecipients(eventIds) : [];
  const profilesById = await fetchProfiles(Array.from(new Set(recipients.map((row) => row.user_id))));

  const recipientsByEventId = new Map<string, TimelineRecipient[]>();
  for (const row of recipients) {
    const profile = profilesById.get(row.user_id);
    const existing = recipientsByEventId.get(row.event_id) || [];

    existing.push({
      id: row.id,
      userId: row.user_id,
      role: row.role || null,
      deliveredAt: row.delivered_at,
      seenAt: row.seen_at,
      emailedAt: row.emailed_at || null,
      profileName: profile?.full_name || null,
      profileEmail: profile?.email || null,
    });

    recipientsByEventId.set(row.event_id, existing);
  }

  return events.map<OrderTimelineEvent>((event) => ({
    id: event.id,
    eventType: event.event_type,
    eventKey: event.event_key,
    title: event.title,
    body: event.body,
    createdAt: event.created_at,
    payload: event.payload || null,
    recipients: recipientsByEventId.get(event.id) || [],
  }));
}

export type { OrderTimelineEvent, TimelineRecipient };
