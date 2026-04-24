"use client";

import Link from "next/link";
import type { OrderItem, OrderWithItems, UserProfile } from "../../lib/orders/types";
import {
  formatDate,
  formatDateTimeForView,
  getOrderDeliveredDate,
  getOrderPlannedDate,
  getOrderProgress,
  getOrderStatus,
  hasComment,
  hasReplacementInOrder,
  isItemOverdue,
  isOrderOverdue,
  orderTypeClasses,
  statusClasses,
  statusSelectClasses,
} from "../../lib/orders/utils";
import { STATUS_OPTIONS } from "../../lib/orders/constants";

type OrdersListMobileProps = {
  loading: boolean;
  orders: OrderWithItems[];
  expandedOrders: number[];
  copiedArticle: string | null;
  user: UserProfile;
  toggleOrderExpand: (orderId: number) => void;
  removeOrder: (id: number) => Promise<void>;
  updateItemStatusQuick: (
    orderId: number,
    item: OrderItem,
    newStatus: string
  ) => Promise<void>;
  copyArticle: (article: string | null) => Promise<void>;
};

export function OrdersListMobile({
  loading,
  orders,
  expandedOrders,
  copiedArticle,
  user,
  toggleOrderExpand,
  removeOrder,
  updateItemStatusQuick,
  copyArticle,
}: OrdersListMobileProps) {
  if (loading) {
    return (
      <div className="rounded-[18px] bg-white p-3 text-center text-[12px] text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-slate-200">
        Загрузка...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-[18px] bg-white p-3 text-center text-[12px] text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-slate-200">
        Ничего не найдено.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => {
        const expanded = expandedOrders.includes(order.id);
        const items = order.order_items || [];
        const orderStatus = getOrderStatus(items);
        const overdue = isOrderOverdue(items);
        const progress = getOrderProgress(items);
        const plannedDate = getOrderPlannedDate(items);
        const fullDeliveredDate = getOrderDeliveredDate(items);
        const orderType = order.order_type || "Стандартный";

        return (
          <div
            key={order.id}
            className={`overflow-hidden rounded-[18px] border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition md:rounded-[22px] ${
              overdue
                ? "border-rose-200"
                : orderStatus === "Поставлен"
                ? "border-emerald-200"
                : orderType === "Срочный"
                ? "border-amber-200"
                : "border-slate-200"
            }`}
          >
            <div
              className={`h-1.5 w-full ${
                overdue
                  ? "bg-rose-500"
                  : orderStatus === "Поставлен"
                  ? "bg-emerald-500"
                  : orderType === "Срочный"
                  ? "bg-amber-500"
                  : orderStatus === "Отменен" || orderStatus === "Частично отменен"
                  ? "bg-rose-400"
                  : orderStatus === "В пути" || orderStatus === "Частично поставлен"
                  ? "bg-violet-500"
                  : orderStatus === "В работе"
                  ? "bg-amber-400"
                  : "bg-slate-400"
              }`}
            />

            <div className="p-3">
              <button
                type="button"
                onClick={() => toggleOrderExpand(order.id)}
                className="block w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {expanded ? "▼" : "▶"}
                      </span>
                      <span className="truncate text-[13px] font-semibold tracking-tight text-slate-900 md:text-[15px]">
                        {order.client_order || "Без номера"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium md:px-2.5 md:text-[10px] ${orderTypeClasses(
                          orderType
                        )}`}
                      >
                        {orderType}
                      </span>

                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium md:px-2.5 md:text-[10px] ${statusClasses(
                          orderStatus
                        )}`}
                      >
                        {orderStatus}
                      </span>

                      {(hasComment(order.comment) || hasReplacementInOrder(items)) && (
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[8px] font-medium text-sky-700 md:text-[9px]">
                          Есть отметки
                        </span>
                      )}

                      {overdue ? (
                        <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[8px] font-medium text-rose-700 md:text-[9px]">
                          Просрочено
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-2 text-[12px] md:mt-3 md:gap-x-2.5 md:gap-y-2.5 md:text-[13px]">
                  <MobileInfo label="Дата заказа" value={formatDate(order.order_date)} />
                  <MobileInfo label="Плановая" value={formatDate(plannedDate)} />
                  <MobileInfo label="Полная поставка" value={formatDate(fullDeliveredDate)} />
                  <MobileInfo
                    label="Изменение"
                    value={
                      order.updated_at
                        ? `${order.updated_by || "—"} · ${formatDateTimeForView(order.updated_at)}`
                        : "—"
                    }
                  />
                </div>

                <div className="mt-2.5 rounded-[16px] border border-slate-200 bg-slate-50/70 px-2.5 py-2 md:mt-3 md:rounded-[18px] md:px-3 md:py-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-slate-600 md:text-[11px]">
                    <span>Прогресс</span>
                    <span>
                      {progress.delivered}/{progress.total}
                    </span>
                  </div>

                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 md:h-2.5">
                    <div
                      className="bg-emerald-500"
                      style={{
                        width:
                          progress.total > 0
                            ? `${(progress.delivered / progress.total) * 100}%`
                            : "0%",
                      }}
                    />
                    <div
                      className="bg-rose-500"
                      style={{
                        width:
                          progress.total > 0
                            ? `${(progress.canceled / progress.total) * 100}%`
                            : "0%",
                      }}
                    />
                    <div
                      className="bg-slate-300"
                      style={{
                        width:
                          progress.total > 0
                            ? `${(progress.active / progress.total) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              </button>

              <div className="mt-2.5 flex flex-wrap gap-1.5 md:mt-3 md:gap-2">
                <Link
                  href={`/orders/${order.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-[16px] border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 md:rounded-2xl md:px-3 md:text-[13px]"
                >
                  Открыть
                </Link>

                {user.role === "admin" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeOrder(order.id);
                    }}
                    className="rounded-[16px] border border-rose-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50 md:rounded-2xl md:px-3 md:text-[13px]"
                  >
                    Удалить
                  </button>
                ) : null}
              </div>

              {expanded ? (
                <div className="mt-3.5 border-t border-slate-200 pt-3.5 md:mt-4 md:pt-4">
                  <div className="mb-2.5 flex items-center justify-between md:mb-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 md:text-[11px]">
                      Позиции
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium text-slate-600 md:px-2.5 md:py-1 md:text-[10px]">
                      {items.length} шт.
                    </div>
                  </div>

                  <div className="space-y-2.5 md:space-y-3">
                    {items.map((item) => {
                      const itemOverdue = isItemOverdue(item);

                      return (
                        <div
                          key={item.id}
                          className={`rounded-[18px] border bg-slate-50/60 p-2.5 md:rounded-[22px] md:p-3 ${
                            itemOverdue ? "border-rose-200" : "border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 md:text-[10px]">
                                Артикул
                              </div>
                              <button
                                onClick={() => copyArticle(item.article)}
                                className="mt-1 rounded-md px-1 py-0.5 text-left text-[12px] font-semibold text-slate-900 transition hover:bg-white md:text-sm"
                              >
                                {item.article || "—"}
                              </button>

                              {copiedArticle === item.article ? (
                                <div className="mt-1 text-[8px] text-emerald-600 md:text-[9px]">
                                  Скопировано
                                </div>
                              ) : null}
                            </div>

                            <div className="flex flex-col items-end gap-1.5">
                              {item.replacement_article ? (
                                <span className="inline-flex shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-medium text-amber-700 md:text-[9px]">
                                  Замена
                                </span>
                              ) : null}

                              {itemOverdue ? (
                                <span className="inline-flex shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[8px] font-medium text-rose-700 md:text-[9px]">
                                  Просрочено
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-2 text-[12px] leading-[1.1rem] text-slate-700 md:text-sm md:leading-5">
                            {item.name || "—"}
                          </div>

                          {item.replacement_article ? (
                            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[9px] font-medium text-amber-700 md:py-2 md:text-[10px]">
                              Актуальный артикул: {item.replacement_article}
                            </div>
                          ) : null}

                          <div className="mt-2.5 grid grid-cols-2 gap-2.5 md:mt-3 md:gap-3">
                            <MobileInfo label="Кол-во" value={item.quantity || "—"} compact />

                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Статус
                              </div>

                              {user.role === "viewer" ? (
                                <span
                                  className={`mt-1 inline-flex rounded-full px-2 py-1 text-[9px] font-medium md:px-2.5 md:text-[10px] ${statusClasses(
                                    item.status || "Новый"
                                  )}`}
                                >
                                  {item.status || "Новый"}
                                </span>
                              ) : (
                                <select
                                  value={item.status || "Новый"}
                                  onChange={(e) =>
                                    updateItemStatusQuick(order.id, item, e.target.value)
                                  }
                                  className={`mt-1 w-full rounded-xl border px-2 py-1.5 text-[9px] font-medium outline-none md:px-2.5 md:py-2 md:text-[10px] ${statusSelectClasses(
                                    item.status || "Новый"
                                  )}`}
                                >
                                  {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            <MobileInfo
                              label="Плановая"
                              value={formatDate(item.planned_date)}
                              compact
                              danger={itemOverdue}
                            />
                            <MobileInfo
                              label="Поставка"
                              value={formatDate(item.delivered_date)}
                              compact
                            />
                            <MobileInfo
                              label="Отмена"
                              value={formatDate(item.canceled_date)}
                              compact
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MobileInfo({
  label,
  value,
  compact = false,
  danger = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
  danger?: boolean;
}) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 md:text-[10px]">
        {label}
      </div>
      <div
        className={`mt-1 ${
          compact ? "text-[12px] md:text-[13px]" : "text-[12px] md:text-sm"
        } leading-5 ${danger ? "font-medium text-rose-600" : "text-slate-700"}`}
      >
        {value}
      </div>
    </div>
  );
}
