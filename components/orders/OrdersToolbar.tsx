"use client";

import { useMemo, useState } from "react";
import type { SortDirection, SortField } from "../../lib/orders/types";

type OrdersToolbarProps = {
  stats: {
    total: number;
    inProgress: number;
    delivered: number;
    overdue: number;
  };
  search: string;
  setSearch: (value: string) => void;
  orderTypeFilter: string;
  setOrderTypeFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  setSortField: (value: SortField) => void;
  setSortDirection: (value: SortDirection) => void;
};

export function OrdersToolbar({
  stats,
  search,
  setSearch,
  orderTypeFilter,
  setOrderTypeFilter,
  statusFilter,
  setStatusFilter,
  sortField,
  sortDirection,
  setSortField,
  setSortDirection,
}: OrdersToolbarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const hasSearch = search.trim().length > 0;
  const isDefaultSort = sortField === "id" && sortDirection === "desc";

  const hasAnyAdvancedFilter = useMemo(() => {
    return (
      orderTypeFilter !== "all" ||
      (statusFilter !== "all" &&
        statusFilter !== "В работе" &&
        statusFilter !== "Поставлен" &&
        statusFilter !== "Просрочено") ||
      !isDefaultSort
    );
  }, [isDefaultSort, orderTypeFilter, statusFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (hasSearch) count += 1;
    if (orderTypeFilter !== "all") count += 1;
    if (statusFilter !== "all") count += 1;
    if (!isDefaultSort) count += 1;
    return count;
  }, [hasSearch, isDefaultSort, orderTypeFilter, statusFilter]);

  const clearAllFilters = () => {
    setSearch("");
    setOrderTypeFilter("all");
    setStatusFilter("all");
    setSortField("id");
    setSortDirection("desc");
    setMobileFiltersOpen(false);
  };

  return (
    <div className="space-y-3 md:space-y-5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        <StatCard
          title="Всего заказов"
          value={stats.total}
          accent="bg-slate-500"
          ring="ring-slate-200"
        />
        <StatCard
          title="В работе"
          value={stats.inProgress}
          accent="bg-amber-500"
          ring="ring-amber-100"
        />
        <StatCard
          title="Поставлено"
          value={stats.delivered}
          accent="bg-emerald-500"
          ring="ring-emerald-100"
        />
        <StatCard
          title="Просрочено"
          value={stats.overdue}
          accent="bg-rose-500"
          ring="ring-rose-100"
        />
      </div>

      <div className="premium-shell rounded-[20px] p-3.5 md:rounded-[26px] md:p-5">
        <div className="flex flex-col gap-3.5 md:gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="premium-ui-title text-[16px] text-slate-900 md:text-[28px]">
                Поиск и фильтрация
              </div>
              <p className="premium-subtitle mt-1 text-[12px] text-slate-500 md:text-sm">
                Найди нужный заказ или отфильтруй список по типу и статусу.
              </p>
            </div>

          </div>

          {activeFilterCount > 0 ? (
            <div className="flex items-center justify-between gap-2 rounded-[18px] border border-stone-200 bg-stone-50/80 px-3 py-2 md:rounded-2xl md:px-4">
              <div className="text-[11px] font-medium text-stone-700 md:text-sm">
                Активных фильтров: {activeFilterCount}
              </div>
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-100 md:text-xs"
              >
                Сбросить всё
              </button>
            </div>
          ) : null}

          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 md:left-4 md:h-5 md:w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20L17 17" />
            </svg>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по заказу, артикулу, замене, наименованию"
              className="h-[42px] w-full rounded-[18px] border border-slate-200/90 bg-white/80 pl-10 pr-3.5 text-[12px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white md:h-[54px] md:rounded-2xl md:pl-11 md:pr-4 md:text-sm"
            />

            {hasSearch ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 md:right-3 md:h-8 md:w-8"
                aria-label="Очистить поиск"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6L14 14" />
                  <path d="M14 6L6 14" />
                </svg>
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 md:hidden">
            <QuickFilterPill
              active={orderTypeFilter === "all" && statusFilter === "all"}
              onClick={() => {
                setOrderTypeFilter("all");
                setStatusFilter("all");
              }}
            >
              Все
            </QuickFilterPill>

            <QuickFilterPill
              active={statusFilter === "В работе"}
              onClick={() => {
                setOrderTypeFilter("all");
                setStatusFilter("В работе");
              }}
            >
              В работе
            </QuickFilterPill>

            <QuickFilterPill
              active={orderTypeFilter === "Срочный"}
              onClick={() => {
                setOrderTypeFilter("Срочный");
                setStatusFilter("all");
              }}
            >
              Срочные
            </QuickFilterPill>

            <QuickFilterPill
              active={statusFilter === "Просрочено"}
              onClick={() => {
                setOrderTypeFilter("all");
                setStatusFilter("Просрочено");
              }}
            >
              Просрочено
            </QuickFilterPill>

            <QuickFilterPill
              active={statusFilter === "Поставлен"}
              onClick={() => {
                setOrderTypeFilter("all");
                setStatusFilter("Поставлен");
              }}
              activeClassName="border-emerald-200 bg-emerald-50 text-emerald-700"
            >
              Поставлено
            </QuickFilterPill>
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="flex h-[42px] w-full items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-semibold text-slate-700">
                  Фильтры
                </span>
                {hasAnyAdvancedFilter ? (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-medium text-white">
                    Активны
                  </span>
                ) : null}
              </div>

              <svg
                viewBox="0 0 20 20"
                className={`h-5 w-5 text-slate-400 transition-transform ${
                  mobileFiltersOpen ? "rotate-180" : ""
                }`}
                fill="currentColor"
              >
                <path d="M5.25 7.5L10 12.25L14.75 7.5H5.25Z" />
              </svg>
            </button>

            {mobileFiltersOpen ? (
              <div className="mt-2.5 grid grid-cols-1 gap-2 rounded-[18px] border border-slate-200 bg-slate-50/70 p-2">
                <select
                  value={orderTypeFilter}
                  onChange={(e) => setOrderTypeFilter(e.target.value)}
                  className="h-[40px] rounded-[14px] border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none focus:border-slate-300"
                >
                  <option value="all">Все типы</option>
                  <option value="Стандартный">Стандартный</option>
                  <option value="Срочный">Срочный</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-[40px] rounded-[14px] border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none focus:border-slate-300"
                >
                  <option value="all">Все статусы</option>
                  <option value="Новый">Новый</option>
                  <option value="В работе">В работе</option>
                  <option value="В пути">В пути</option>
                  <option value="Поставлен">Поставлен</option>
                  <option value="Отменен">Отменен</option>
                  <option value="Частично поставлен">Частично поставлен</option>
                  <option value="Частично отменен">Частично отменен</option>
                  <option value="Без плановой даты">Без плановой даты</option>
                  <option value="Просрочено">Просрочено</option>
                </select>

                <select
                  value={`${sortField}:${sortDirection}`}
                  onChange={(e) => {
                    const [field, direction] = e.target.value.split(":") as [
                      SortField,
                      SortDirection
                    ];
                    setSortField(field);
                    setSortDirection(direction);
                  }}
                  className="h-[40px] rounded-[14px] border border-slate-200 bg-white px-3 text-[12px] text-slate-900 outline-none focus:border-slate-300"
                >
                  <option value="id:desc">Сначала новые</option>
                  <option value="id:asc">Сначала старые</option>
                  <option value="order_date:asc">Дата заказа ↑</option>
                  <option value="order_date:desc">Дата заказа ↓</option>
                  <option value="order_type:asc">Тип А-Я</option>
                  <option value="order_type:desc">Тип Я-А</option>
                  <option value="status:asc">Статус А-Я</option>
                  <option value="status:desc">Статус Я-А</option>
                  <option value="client_order:asc">№ заказа А-Я</option>
                  <option value="client_order:desc">№ заказа Я-А</option>
                  <option value="progress:desc">Больше поставлено</option>
                  <option value="progress:asc">Меньше поставлено</option>
                  <option value="updated_at:desc">Свежее изменение</option>
                  <option value="updated_at:asc">Старое изменение</option>
                </select>

                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="h-[40px] rounded-[14px] border border-stone-200 bg-white px-3 text-[12px] font-medium text-stone-700 transition hover:bg-stone-50"
                  >
                    Сбросить фильтры
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="hidden gap-3 md:grid md:grid-cols-4 xl:grid-cols-[190px_190px_220px_auto]">
            <select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value)}
              className="h-[50px] rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-slate-300 focus:bg-white"
            >
              <option value="all">Все типы</option>
              <option value="Стандартный">Стандартный</option>
              <option value="Срочный">Срочный</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-[50px] rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-slate-300 focus:bg-white"
            >
              <option value="all">Все статусы</option>
              <option value="Новый">Новый</option>
              <option value="В работе">В работе</option>
              <option value="В пути">В пути</option>
              <option value="Поставлен">Поставлен</option>
              <option value="Отменен">Отменен</option>
              <option value="Частично поставлен">Частично поставлен</option>
              <option value="Частично отменен">Частично отменен</option>
              <option value="Без плановой даты">Без плановой даты</option>
              <option value="Просрочено">Просрочено</option>
            </select>

            <select
              value={`${sortField}:${sortDirection}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split(":") as [
                  SortField,
                  SortDirection
                ];
                setSortField(field);
                setSortDirection(direction);
              }}
              className="h-[50px] rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-slate-300 focus:bg-white"
            >
              <option value="id:desc">Сначала новые</option>
              <option value="id:asc">Сначала старые</option>
              <option value="order_date:asc">Дата заказа ↑</option>
              <option value="order_date:desc">Дата заказа ↓</option>
              <option value="order_type:asc">Тип А-Я</option>
              <option value="order_type:desc">Тип Я-А</option>
              <option value="status:asc">Статус А-Я</option>
              <option value="status:desc">Статус Я-А</option>
              <option value="client_order:asc">№ заказа А-Я</option>
              <option value="client_order:desc">№ заказа Я-А</option>
              <option value="progress:desc">Больше поставлено</option>
              <option value="progress:asc">Меньше поставлено</option>
              <option value="updated_at:desc">Свежее изменение</option>
              <option value="updated_at:asc">Старое изменение</option>
            </select>

            <button
              type="button"
              onClick={clearAllFilters}
              disabled={activeFilterCount === 0}
              className="h-[50px] rounded-2xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickFilterPill({
  children,
  active,
  onClick,
  activeClassName,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  activeClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition md:px-4 md:py-2.5 md:text-sm ${
        active
          ? activeClassName || "bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
          : "border border-slate-200 bg-white/85 text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  title,
  value,
  accent,
  ring,
}: {
  title: string;
  value: number;
  accent: string;
  ring: string;
}) {
  return (
    <div
      className={`premium-card-hover relative overflow-hidden rounded-[18px] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 md:rounded-[28px] md:p-5 ${ring}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-[radial-gradient(circle_at_top,rgba(180,138,76,0.08),transparent_65%)]" />
      <div className="flex items-start justify-between gap-3">
        <div className="text-[12px] font-medium text-slate-500 md:text-sm">{title}</div>
        <div className={`mt-1 h-2.5 w-2.5 rounded-full md:h-3 md:w-3 ${accent}`} />
      </div>

      <div className="mt-3 text-[34px] font-semibold tracking-tight text-slate-900 md:mt-4 md:text-4xl">
        {value}
      </div>

      <div className="mt-2.5 h-1.5 w-14 rounded-full bg-slate-100 md:mt-3 md:w-16">
        <div className={`h-1.5 w-7 rounded-full md:w-8 ${accent}`} />
      </div>
    </div>
  );
}
