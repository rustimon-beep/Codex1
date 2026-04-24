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

  const hasAnyAdvancedFilter = useMemo(() => {
    return (
      orderTypeFilter !== "all" ||
      (statusFilter !== "all" &&
        statusFilter !== "В работе" &&
        statusFilter !== "Поставлен" &&
        statusFilter !== "Просрочено") ||
      !(sortField === "id" && sortDirection === "desc")
    );
  }, [orderTypeFilter, statusFilter, sortField, sortDirection]);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
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

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] md:p-6">
        <div className="flex flex-col gap-4 md:gap-5">
          <div>
            <div className="text-[22px] font-semibold tracking-tight text-slate-900 md:text-[28px]">
              Поиск и фильтрация
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Найди нужный заказ или отфильтруй список по типу и статусу.
            </p>
          </div>

          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
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
              className="h-[58px] w-full rounded-[24px] border border-slate-200 bg-slate-50 pl-12 pr-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white md:h-[56px] md:rounded-2xl md:text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 md:hidden">
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
              className="flex h-[58px] w-full items-center justify-between rounded-[24px] border border-slate-200 bg-slate-50 px-5 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-[15px] font-semibold text-slate-700">
                  Фильтры
                </span>
                {hasAnyAdvancedFilter ? (
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-medium text-white">
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
              <div className="mt-3 grid grid-cols-1 gap-2.5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-3">
                <select
                  value={orderTypeFilter}
                  onChange={(e) => setOrderTypeFilter(e.target.value)}
                  className="h-[54px] rounded-[20px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                >
                  <option value="all">Все типы</option>
                  <option value="Стандартный">Стандартный</option>
                  <option value="Срочный">Срочный</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-[54px] rounded-[20px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                >
                  <option value="all">Все статусы</option>
                  <option value="Новый">Новый</option>
                  <option value="В работе">В работе</option>
                  <option value="В пути">В пути</option>
                  <option value="Поставлен">Поставлен</option>
                  <option value="Отменен">Отменен</option>
                  <option value="Частично поставлен">Частично поставлен</option>
                  <option value="Частично отменен">Частично отменен</option>
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
                  className="h-[54px] rounded-[20px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
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
              </div>
            ) : null}
          </div>

          <div className="hidden md:grid md:grid-cols-3 xl:grid-cols-[190px_190px_220px] gap-3">
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
      className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
        active
          ? activeClassName || "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-700"
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
      className={`rounded-[28px] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 ${ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-slate-500">{title}</div>
        <div className={`mt-1 h-3 w-3 rounded-full ${accent}`} />
      </div>

      <div className="mt-4 text-5xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {value}
      </div>

      <div className="mt-3 h-1.5 w-16 rounded-full bg-slate-100">
        <div className={`h-1.5 w-8 rounded-full ${accent}`} />
      </div>
    </div>
  );
}