create extension if not exists pgcrypto;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in ('new_order', 'overdue', 'status_changed', 'cancellation', 'planned_date_changed')
  ),
  event_key text not null unique,
  order_id bigint references public.orders_v2 (id) on delete cascade,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_recipients (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.notification_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'supplier', 'buyer')),
  delivered_at timestamptz null,
  seen_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz null
);

create index if not exists notification_recipients_user_id_idx
  on public.notification_recipients (user_id);

create index if not exists notification_recipients_delivered_at_idx
  on public.notification_recipients (delivered_at);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.notification_events enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "notification_events_select_authenticated" on public.notification_events;
create policy "notification_events_select_authenticated"
on public.notification_events
for select
to authenticated
using (true);

drop policy if exists "notification_events_insert_authenticated" on public.notification_events;
create policy "notification_events_insert_authenticated"
on public.notification_events
for insert
to authenticated
with check (true);

drop policy if exists "notification_recipients_select_own" on public.notification_recipients;
create policy "notification_recipients_select_own"
on public.notification_recipients
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "notification_recipients_insert_authenticated" on public.notification_recipients;
create policy "notification_recipients_insert_authenticated"
on public.notification_recipients
for insert
to authenticated
with check (true);

drop policy if exists "notification_recipients_update_own" on public.notification_recipients;
create policy "notification_recipients_update_own"
on public.notification_recipients
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
on public.push_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
on public.push_subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
on public.push_subscriptions
for delete
to authenticated
using (auth.uid() = user_id);

alter publication supabase_realtime add table public.notification_recipients;

alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

alter table public.notification_events
  add constraint notification_events_event_type_check
  check (
    event_type in ('new_order', 'overdue', 'status_changed', 'cancellation', 'planned_date_changed')
  );
