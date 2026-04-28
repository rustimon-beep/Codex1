alter table public.order_items
  add column if not exists initial_planned_date date null,
  add column if not exists planned_date_change_count integer not null default 0,
  add column if not exists planned_date_last_changed_at timestamptz null,
  add column if not exists planned_date_last_changed_by text null,
  add column if not exists deadline_breached_at timestamptz null;

update public.order_items
set initial_planned_date = planned_date
where initial_planned_date is null
  and planned_date is not null;

update public.order_items
set deadline_breached_at = now()
where deadline_breached_at is null
  and initial_planned_date is not null
  and initial_planned_date < current_date
  and status not in ('Поставлен', 'Отменен');

create table if not exists public.order_item_schedule_history (
  id bigint generated always as identity primary key,
  order_item_id bigint not null references public.order_items (id) on delete cascade,
  order_id bigint not null references public.orders_v2 (id) on delete cascade,
  supplier_id bigint null references public.suppliers (id) on delete set null,
  previous_planned_date date null,
  next_planned_date date null,
  changed_by text not null,
  changed_at timestamptz not null default now(),
  changed_after_overdue boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists order_item_schedule_history_order_item_id_idx
  on public.order_item_schedule_history (order_item_id);

create index if not exists order_item_schedule_history_order_id_idx
  on public.order_item_schedule_history (order_id);

create index if not exists order_item_schedule_history_supplier_id_idx
  on public.order_item_schedule_history (supplier_id);
