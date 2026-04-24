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

type OrdersAttentionPanelProps = {
  cards: AttentionCard[];
  topAttentionOrders: AttentionEntry[];
  onApplyFocus: (params: {
    statusFilter: string;
    orderTypeFilter: string;
    sortField: SortField;
    sortDirection: SortDirection;
  }) => void;
};

export function OrdersAttentionPanel({
  cards,
  topAttentionOrders,
  onApplyFocus,
}: OrdersAttentionPanelProps) {
  return (
    <div className="hidden grid-cols-[1.2fr_0.8fr] gap-4 md:grid">
      <div className="premium-shell rounded-[28px] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Фокус дня
            </div>
            <div className="premium-title mt-2 text-[26px] font-semibold tracking-tight text-slate-900">
              Что требует внимания
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Быстрый переход к проблемным и приоритетным заказам.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
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
              className="premium-card-hover rounded-[22px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,242,0.94))] p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
                {card.title}
              </div>
              <div className="mt-2 text-[34px] font-semibold tracking-tight text-slate-900">
                {card.count}
              </div>
              <div className="mt-1 text-[12px] leading-5 text-slate-500">{card.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="premium-shell rounded-[28px] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
          Приоритетный список
        </div>
        <div className="premium-title mt-2 text-[22px] font-semibold tracking-tight text-slate-900">
          С чего начать
        </div>

        <div className="mt-4 space-y-3">
          {topAttentionOrders.length === 0 ? (
            <div className="rounded-[22px] border border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-600">
              Сейчас критичных заказов не видно. Это хороший знак.
            </div>
          ) : (
            topAttentionOrders.map(({ order, reasons, status }) => {
              const orderType = order.order_type || "Стандартный";

              return (
                <div
                  key={order.id}
                  className="rounded-[22px] border border-stone-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[18px] font-semibold tracking-tight text-slate-900">
                        {order.client_order || "Без номера"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${orderTypeClasses(
                            orderType
                          )}`}
                        >
                          {orderType}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClasses(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/orders/${order.id}`}
                      className="route-link rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
                    >
                      Открыть
                    </Link>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {reasons.map((reason) => (
                      <span
                        key={reason}
                        className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 text-[12px] text-slate-500">
                    Последнее изменение: {formatDateTimeForView(order.updated_at)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
