create table if not exists public.suppliers (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_select_authenticated" on public.suppliers;
create policy "suppliers_select_authenticated"
on public.suppliers
for select
to authenticated
using (true);

alter table public.profiles
  add column if not exists supplier_id bigint references public.suppliers (id) on delete set null;

create index if not exists profiles_supplier_id_idx
  on public.profiles (supplier_id);

alter table public.orders_v2
  add column if not exists supplier_id bigint references public.suppliers (id) on delete set null;

create index if not exists orders_v2_supplier_id_idx
  on public.orders_v2 (supplier_id);

create table if not exists public.order_item_first_overdue (
  id bigint generated always as identity primary key,
  order_item_id bigint not null unique references public.order_items (id) on delete cascade,
  order_id bigint not null references public.orders_v2 (id) on delete cascade,
  supplier_id bigint null references public.suppliers (id) on delete set null,
  first_planned_date date null,
  first_overdue_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists order_item_first_overdue_supplier_id_idx
  on public.order_item_first_overdue (supplier_id);

create index if not exists order_item_first_overdue_order_id_idx
  on public.order_item_first_overdue (order_id);
