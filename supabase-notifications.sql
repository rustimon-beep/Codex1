create extension if not exists pgcrypto;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in ('new_order', 'overdue', 'status_changed', 'cancellation')
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

create index if not exists notification_recipients_user_id_idx
  on public.notification_recipients (user_id);

create index if not exists notification_recipients_delivered_at_idx
  on public.notification_recipients (delivered_at);

alter table public.notification_events enable row level security;
alter table public.notification_recipients enable row level security;

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

alter publication supabase_realtime add table public.notification_recipients;
