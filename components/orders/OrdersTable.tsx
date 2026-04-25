"use client";

import Link from "next/link";
import { Fragment } from "react";
import type { OrderItem, OrderWithItems, UserProfile } from "../../lib/orders/types";
import { EmptyStateCard } from "../ui/EmptyStateCard";
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

type OrdersTableProps = {
  loading: boolean;
  orders: OrderWithItems[];
  expandedOrders: number[];
  copiedArticle: string | null;
  user: UserProfile;
  toggleOrderExpand: (orderId: number) => void;
  removeOrder: (id: number) => void | Promise<void>;
  updateItemStatusQuick: (
    orderId: number,
    item: OrderItem,
    newStatus: string
  ) => void | Promise<void>;
  copyArticle: (article: string | null) => void | Promise<void>;
};

const STATUS_OPTIONS = [
  "Новый",
  "В работе",
  "В пути",
  "Поставлен",
  "Отменен",
];

function hasMissingPlannedDate(items: OrderItem[]) {
  return items.some(
    (item) =>
      item.status !== "Поставлен" &&
      item.status !== "Отменен" &&
      !item.planned_date
  );
}

export function OrdersTable({
  loading,
  orders,
  expandedOrders,
  copiedArticle,
  user,
  toggleOrderExpand,
  removeOrder,
  updateItemStatusQuick,
  copyArticle,
}: OrdersTableProps) {
  const getQuickStatusOptions = (_currentStatus: string) => {
    return STATUS_OPTIONS;
  };

  return (
    <div className="premium-shell route-stage overflow-hidden rounded-[26px]">
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="premium-grid text-slate-600">
            <tr>
              <th className="sticky top-0 z-10 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Заказ</th>
              <th className="sticky top-0 z-10 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Тип</th>
              <th className="sticky top-0 z-10 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Дата заказа</th>
              <th className="sticky top-0 z-10 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Общий статус</th>
              <th className="sticky top-0 z-10 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Прогресс</th>
              <th className="sticky top-0 z-10 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Плановая</th>
              <th className="sticky top-0 z-10 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Полная поставка</th>
              <th className="sticky top-0 z-10 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Последнее изменение</th>
            </tr>
          </thead>

          <tbody className="[&>tr:hover]:shadow-[0_6px_16px_rgba(15,23,42,0.06)]">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center text-slate-500">
                  Загрузка...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10">
                  <EmptyStateCard
                    compact
                    title="Заказы не найдены"
                    description="Попробуй изменить фильтры, поиск или сбросить ограничения, чтобы снова увидеть список."
                  />
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const expanded = expandedOrders.includes(order.id);
                const items = order.order_items || [];
                const orderStatus = getOrderStatus(items);
                const overdue = isOrderOverdue(items);
                const progress = getOrderProgress(items);
                const plannedDate = getOrderPlannedDate(items);
                const fullDeliveredDate = getOrderDeliveredDate(items);
                const orderType = order.order_type || "Стандартный";
                const missingPlannedDate = hasMissingPlannedDate(items);

                const hasOrderComment = hasComment(order.comment);
                const hasOrderReplacement = hasReplacementInOrder(items);

                const flagMessages: string[] = [];
                if (hasOrderComment) flagMessages.push("Есть комментарий");
                if (hasOrderReplacement) flagMessages.push("Есть замены");
                const flagTitle = flagMessages.join(" • ");

                return (
                  <Fragment key={order.id}>
                    <tr
                      onClick={() => toggleOrderExpand(order.id)}
                      className={`align-top cursor-pointer transition-all duration-200 group premium-card-hover ${
                        overdue
                          ? "bg-rose-50/40 hover:bg-rose-50"
                          : orderStatus === "Поставлен"
                          ? "bg-emerald-50/40 hover:bg-emerald-50"
                          : "bg-white hover:bg-slate-50"
                      } ${expanded ? "ring-1 ring-slate-200 bg-slate-50" : ""}`}
                    >
                      <td className="border-t border-slate-100 px-5 py-3">
                        <div className="flex items-start gap-4">
                          <div
                            className={`mt-1 h-9 w-1.5 rounded-full ${
                              overdue
                                ? "bg-rose-500"
                                : orderStatus === "Поставлен"
                                ? "bg-emerald-500"
                                : orderStatus === "Отменен" ||
                                  orderStatus === "Частично отменен"
                                ? "bg-rose-400"
                                : orderStatus === "В пути" ||
                                  orderStatus === "Частично поставлен"
                                ? "bg-violet-500"
                                : orderStatus === "В работе"
                                ? "bg-amber-500"
                                : "bg-slate-300"
                            }`}
                          />

                          <div className="min-w-0">
                            <div className="rounded-xl px-1 py-0.5 text-left">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold tracking-tight text-slate-900">
                                  {order.client_order || "Без номера"}
                                </span>

                                {flagMessages.length > 0 ? (
                                  <div className="relative group/flag" title={flagTitle}>
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-stone-200 bg-stone-50 px-1.5 text-[11px] leading-none text-stone-600 transition hover:border-stone-300 hover:bg-stone-100"
                                      aria-label={flagTitle}
                                    >
                                      ⚑
                                    </button>

                                    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-max max-w-[220px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.12)] group-hover/flag:block">
                                      {flagMessages.map((message, index) => (
                                        <div key={index}>{message}</div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                <span
                                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition ${expanded ? "rotate-180" : ""}`}
                                >
                                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                                    <path d="M5.25 7.5L10 12.25L14.75 7.5H5.25Z" />
                                  </svg>
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center gap-2 whitespace-nowrap">
                              <Link
                                href={`/orders/${order.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="route-link rounded-xl border border-slate-200 bg-white/92 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                Открыть
                              </Link>

                              {user.role === "admin" ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void removeOrder(order.id);
                                  }}
                                  className="rounded-xl border border-rose-200 bg-white/92 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                                >
                                  Удалить
                                </button>
                              ) : null}
                            </div>

                            {(overdue || missingPlannedDate) && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {overdue ? (
                                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                                    Просрочен
                                  </span>
                                ) : null}
                                {missingPlannedDate ? (
                                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                                    Нет плановой даты
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="border-t border-slate-100 px-5 py-3">
                        <span
                          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${orderTypeClasses(
                            orderType
                          )}`}
                        >
                          {orderType}
                        </span>
                      </td>

                      <td className="border-t border-slate-100 px-5 py-3 text-slate-700">
                        {formatDate(order.order_date)}
                      </td>

                      <td className="border-t border-slate-100 px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                            orderStatus
                          )}`}
                        >
                          {orderStatus}
                        </span>
                      </td>

                      <td className="border-t border-slate-100 px-5 py-3">
                        <div className="min-w-[160px]">
                          <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-500">
                            <span>Готовность</span>
                            <span className="text-slate-700">
                              {progress.delivered}/{progress.total}
                            </span>
                          </div>

                          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
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
                      </td>

                      <td className="border-t border-slate-100 px-5 py-3 text-slate-700">
                        {formatDate(plannedDate)}
                      </td>

                      <td className="border-t border-slate-100 px-5 py-3 text-slate-700">
                        {formatDate(fullDeliveredDate)}
                      </td>

                      <td className="border-t border-slate-100 px-5 py-3">
                        {order.updated_at ? (
                          <div className="max-w-[170px]">
                            <div className="text-sm font-medium text-slate-800">
                              {order.updated_by || "—"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDateTimeForView(order.updated_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>

                    {expanded ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="border-t border-slate-100 bg-slate-50/70 px-5 py-4"
                        >
                          <div className="premium-shell rounded-[24px] p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                            <div className="mb-4 flex items-center justify-between">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  Позиции заказа
                                </div>
                                <div className="mt-1 text-sm text-slate-500">
                                  Детали по каждой позиции, статусу и срокам
                                </div>
                              </div>

                              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                                {items.length} шт.
                              </div>
                            </div>

                            <div className="space-y-3">
                              {items.map((item) => {
                                const itemOverdue = isItemOverdue(item);

                                return (
                                  <div
                                    key={item.id}
                                    className={`premium-card-hover grid grid-cols-[1.05fr_1.6fr_0.55fr_0.9fr_0.8fr_0.8fr_0.8fr] gap-4 rounded-2xl border bg-white px-4 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] ${
                                      itemOverdue
                                        ? "border-rose-200 ring-1 ring-rose-100"
                                        : "border-slate-200"
                                    }`}
                                  >
                                    <div>
                                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        Артикул
                                      </div>

                                      <button
                                        onClick={() => copyArticle(item.article)}
                                        className="rounded px-1 py-0.5 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                                        title="Нажми, чтобы скопировать артикул"
                                      >
                                        {item.article || "—"}
                                      </button>

                                      {item.replacement_article ? (
                                        <div className="mt-2 space-y-1">
                                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                            Замена
                                          </span>
                                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                                            {item.replacement_article}
                                          </div>
                                        </div>
                                      ) : null}

                                      {copiedArticle === item.article ? (
                                        <div className="mt-2 text-[10px] font-medium text-emerald-600">
                                          Скопировано
                                        </div>
                                      ) : null}
                                    </div>

                                    <div>
                                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        Наименование
                                      </div>
                                      <div className="text-sm leading-6 text-slate-700">
                                        {item.name || "—"}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        Кол-во
                                      </div>
                                      <div className="text-sm font-semibold text-slate-900">
                                        {item.quantity || "—"}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        Статус
                                      </div>

                                      {user.role === "viewer" ? (
                                        <span
                                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                                            item.status || "Новый"
                                          )}`}
                                        >
                                          {item.status || "Новый"}
                                        </span>
                                      ) : (
                                        <>
                                          <select
                                            value={item.status || "Новый"}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) =>
                                              updateItemStatusQuick(
                                                order.id,
                                                item,
                                                e.target.value
                                              )
                                            }
                                            className={`rounded-xl border px-3 py-2 text-xs font-medium outline-none ${statusSelectClasses(
                                              item.status || "Новый"
                                            )}`}
                                          >
                                            {getQuickStatusOptions(item.status || "Новый").map((status) => (
                                              <option key={status} value={status}>
                                                {status}
                                              </option>
                                            ))}
                                          </select>

                                          
                                        </>
                                      )}
                                    </div>

                                    <div>
                                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        Плановая
                                      </div>
                                      <div className="text-sm text-slate-700">
                                        {formatDate(item.planned_date)}
                                      </div>
                                      {itemOverdue ? (
                                        <div className="mt-1 text-[10px] font-medium text-rose-600">
                                          Просрочено
                                        </div>
                                      ) : null}
                                    </div>

                                    <div>
                                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        Поставка
                                      </div>
                                      <div className="text-sm text-slate-700">
                                        {formatDate(item.delivered_date)}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        Отмена
                                      </div>
                                      <div className="text-sm text-slate-700">
                                        {formatDate(item.canceled_date)}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
