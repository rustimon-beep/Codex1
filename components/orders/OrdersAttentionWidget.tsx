"use client";

import Link from "next/link";
import type { SortDirection, SortField } from "../../lib/orders/types";
import { formatDateTimeForView, orderTypeClasses, statusClasses } from "../../lib/orders/utils";

type AttentionCard = {
  key: string;
  title: string;
  description: string;
  count: number;
  statusFilter: string;
  orderTypeFilter: string;
  sortField: SortField;
  sortDirection: SortDirection;
};

type AttentionEntry = {
  order: {
    id: number;
    client_order: string | null;
    order_type: string | null;
    updated_at: string | null;
  };
  reasons: string[];
  status: string;
};

type OrdersAttentionWidgetProps = {
  open: boolean;
  hasAttentionItems: boolean;
  cards: AttentionCard[];
  topAttentionOrders: AttentionEntry[];
  onToggle: () => void;
  onApplyFocus: (params: {
    statusFilter: string;
    orderTypeFilter: string;
    sortField: SortField;
    sortDirection: SortDirection;
  }) => void;
};

export function OrdersAttentionWidget({
  open,
  hasAttentionItems,
  cards,
  topAttentionOrders,
  onToggle,
  onApplyFocus,
}: OrdersAttentionWidgetProps) {
  return (
    <div className="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 md:block">
      <div className="relative flex items-start gap-3">
        {open ? (
          <div className="premium-shell w-[360px] rounded-[28px] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Фокус дня
                </div>
                <div className="premium-title mt-2 text-[22px] font-semibold tracking-tight text-slate-900">
                  Что проверить
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Короткий список приоритетов без перегруза страницы.
                </div>
              </div>

              <button
                type="button"
                onClick={onToggle}
                className="rounded-full border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-50"
                aria-label="Скрыть фокус дня"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 5L15 15" />
                  <path d="M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {cards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() =>
                    onApplyFocus({
                      statusFilter: card.statusFilter,
                      orderTypeFilter: card.orderTypeFilter,
                      sortField: card.sortField,
                      sortDirection: card.sortDirection,
                    })
                  }
                  className="rounded-[20px] border border-stone-200 bg-white px-3 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:bg-stone-50"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                    {card.title}
                  </div>
                  <div className="mt-1 text-[28px] font-semibold tracking-tight text-slate-900">
                    {card.count}
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-slate-500">
                    {card.description}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2.5">
              {topAttentionOrders.length === 0 ? (
                <div className="rounded-[20px] border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm text-stone-600">
                  Сейчас критичных заказов не видно.
                </div>
              ) : (
                topAttentionOrders.slice(0, 3).map(({ order, reasons, status }) => {
                  const orderType = order.order_type || "Стандартный";

                  return (
                    <div
                      key={order.id}
                      className="rounded-[20px] border border-stone-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[16px] font-semibold tracking-tight text-slate-900">
                            {order.client_order || "Без номера"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${orderTypeClasses(
                                orderType
                              )}`}
                            >
                              {orderType}
                            </span>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${statusClasses(
                                status
                              )}`}
                            >
                              {status}
                            </span>
                          </div>
                        </div>

                        <Link
                          href={`/orders/${order.id}`}
                          className="route-link rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] font-medium text-stone-700 transition hover:bg-stone-100"
                        >
                          Открыть
                        </Link>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {reasons.slice(0, 2).map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500">
                        {formatDateTimeForView(order.updated_at)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          className={`premium-shell flex items-center gap-3 rounded-full border px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.14)] transition ${
            open
              ? "border-stone-300 bg-stone-100 text-stone-800"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3L14.8 8.6L21 9.5L16.5 13.8L17.6 20L12 17.1L6.4 20L7.5 13.8L3 9.5L9.2 8.6L12 3Z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              Фокус дня
            </div>
            <div className="text-sm font-semibold">
              {hasAttentionItems ? "Есть приоритеты" : "Всё спокойно"}
            </div>
          </div>
          {hasAttentionItems ? (
            <div className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              Есть
            </div>
          ) : null}
        </button>
      </div>
    </div>
  );
}
