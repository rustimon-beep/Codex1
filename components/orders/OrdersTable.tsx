"use client";

import Link from "next/link";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
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
  parseComments,
  statusClasses,
  statusSelectClasses,
} from "../../lib/orders/utils";

type OrdersTableProps = {
  loading: boolean;
  orders: OrderWithItems[];
  expandedOrders: number[];
  copiedArticle: string | null;
  search: string;
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

const STATUS_OPTIONS = ["Новый", "В работе", "В пути", "Поставлен", "Отменен"];

export function OrdersTable({
  loading,
  orders,
  expandedOrders,
  copiedArticle,
  search,
  user,
  toggleOrderExpand,
  removeOrder,
  updateItemStatusQuick,
  copyArticle,
}: OrdersTableProps) {
  const highlightQuery = search.trim();
  const normalizedHighlightQuery = highlightQuery.toLowerCase();
  const getQuickStatusOptions = (_currentStatus: string) => {
    return STATUS_OPTIONS;
  };
  const [detailsOrderId, setDetailsOrderId] = useState<number | null>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!detailsOrderId) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!detailsRef.current?.contains(event.target as Node)) {
        setDetailsOrderId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [detailsOrderId]);

  const matchesHighlight = (value: string | null | undefined) =>
    Boolean(
      normalizedHighlightQuery &&
        value &&
        value.toLowerCase().includes(normalizedHighlightQuery)
    );

  const renderHighlightedText = (
    value: string | null | undefined,
    emptyFallback = "—"
  ): ReactNode => {
    if (!value) return emptyFallback;
    if (!normalizedHighlightQuery) return value;

    const normalizedValue = value.toLowerCase();
    const start = normalizedValue.indexOf(normalizedHighlightQuery);

    if (start === -1) return value;

    const end = start + normalizedHighlightQuery.length;

    return (
      <>
        {value.slice(0, start)}
        <mark className="rounded-md bg-amber-200/80 px-1 py-0.5 text-inherit shadow-[inset_0_0_0_1px_rgba(180,138,76,0.18)]">
          {value.slice(start, end)}
        </mark>
        {value.slice(end)}
      </>
    );
  };

  return (
    <div className="premium-shell route-stage overflow-hidden rounded-[24px]">
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="premium-grid text-slate-600">
            <tr>
              <th className="premium-kicker sticky top-0 z-10 px-5 py-3 text-[10px] text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Заказ</th>
              <th className="premium-kicker sticky top-0 z-10 px-5 py-3 text-[10px] text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Тип</th>
              <th className="premium-kicker sticky top-0 z-10 px-5 py-3 text-[10px] text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Дата заказа</th>
              <th className="premium-kicker sticky top-0 z-10 px-5 py-3 text-[10px] text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Общий статус</th>
              <th className="premium-kicker sticky top-0 z-10 px-5 py-3 text-[10px] text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Прогресс</th>
              <th className="premium-kicker sticky top-0 z-10 px-5 py-3 text-[10px] text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Плановая</th>
              <th className="premium-kicker sticky top-0 z-10 px-5 py-3 text-[10px] text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Полная поставка</th>
              <th className="premium-kicker sticky top-0 z-10 px-5 py-3 text-[10px] text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-[rgba(250,247,242,0.88)]">Последнее изменение</th>
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
                const hasCanceledItems = items.some(
                  (item) => (item.status || "Новый") === "Отменен" || !!item.canceled_date
                );
                const orderStatus = getOrderStatus(items);
                const overdue = isOrderOverdue(items);
                const progress = getOrderProgress(items);
                const plannedDate = getOrderPlannedDate(items);
                const fullDeliveredDate = getOrderDeliveredDate(items);
                const orderType = order.order_type || "Стандартный";
                const supplierName = order.supplier?.name?.trim() || null;
                const hasOrderComment = hasComment(order.comment);
                const hasOrderReplacement = hasReplacementInOrder(items);
                const parsedCommentEntries = parseComments(order.comment || "");
                const hasDetails = hasOrderComment || hasOrderReplacement;
                const detailsOpen = detailsOrderId === order.id;

                return (
                  <Fragment key={order.id}>
                    <tr
                      onClick={() => toggleOrderExpand(order.id)}
                      className={`align-middle cursor-pointer transition-all duration-200 group premium-card-hover ${
                        overdue
                          ? "bg-rose-50/40 hover:bg-rose-50"
                          : orderStatus === "Поставлен"
                          ? "bg-emerald-50/40 hover:bg-emerald-50"
                          : "bg-white hover:bg-slate-50"
                      } ${expanded ? "ring-1 ring-slate-200 bg-slate-50" : ""} ${
                        detailsOpen ? "relative z-30" : ""
                      }`}
                    >
                      <td className={`border-t border-[#E5E7EB] px-5 py-2.5 ${detailsOpen ? "relative z-30" : ""}`}>
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`mt-1 h-8 w-1.5 rounded-full ${
                              overdue
                                ? "bg-rose-500"
                                : orderStatus === "Поставлен"
                                ? "bg-emerald-500"
                                : orderStatus === "Частично поставлен"
                                ? "bg-teal-500"
                                : orderStatus === "Отменен"
                                ? "bg-rose-400"
                                : orderStatus === "В пути"
                                ? "bg-fuchsia-500"
                                : orderStatus === "В работе"
                                ? "bg-sky-500"
                                : "bg-slate-300"
                            }`}
                          />

                          <div className="min-w-0">
                            <div className="rounded-xl px-1 py-0.5 text-left">
                              <div className="flex items-center gap-2">
                                <span className="premium-ui-title text-[15px] text-slate-900 md:text-[17px]">
                                  {order.client_order || "Без номера"}
                                </span>

                                {hasDetails ? (
                                  <div className="relative" ref={detailsOpen ? detailsRef : null}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDetailsOrderId((prev) =>
                                          prev === order.id ? null : order.id
                                        );
                                      }}
                                      className="inline-flex h-7 min-w-[24px] items-center justify-center rounded-[10px] border border-stone-200 bg-stone-50 px-1.5 text-[11px] leading-none text-stone-600 transition hover:border-stone-300 hover:bg-stone-100"
                                      aria-label="Показать детали заказа"
                                    >
                                      ⚑
                                    </button>

                                    {detailsOpen ? (
                                      <div className="absolute left-0 top-full z-50 mt-2 w-[320px] max-w-[min(320px,calc(100vw-3rem))] rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_18px_44px_rgba(15,23,42,0.14)]">
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                            Детали заказа
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDetailsOrderId(null);
                                            }}
                                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100"
                                          >
                                            Закрыть
                                          </button>
                                        </div>

                                        <div className="mt-3 space-y-3">
                                          {hasOrderReplacement ? (
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
                                              В заказе есть позиции с заменами.
                                            </div>
                                          ) : null}

                                          {hasOrderComment ? (
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                                              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                                Комментарии
                                              </div>
                                              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                                                {parsedCommentEntries.map((entry, index) => (
                                                  <div
                                                    key={`${order.id}-comment-${index}`}
                                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                                                  >
                                                    <div className="flex items-center justify-between gap-3">
                                                      <div className="text-[11px] font-semibold text-slate-800">
                                                        {entry.author}
                                                      </div>
                                                      <div className="text-[10px] text-slate-400">
                                                        {entry.datetime}
                                                      </div>
                                                    </div>
                                                    <div className="mt-1.5 text-[12px] leading-5 text-slate-700">
                                                      {entry.text}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}

                                <span
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition ${expanded ? "rotate-180" : ""}`}
                                >
                                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                                    <path d="M5.25 7.5L10 12.25L14.75 7.5H5.25Z" />
                                  </svg>
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center gap-2 whitespace-nowrap">
                              <Link
                                href={
                                  highlightQuery
                                    ? `/orders/${order.id}?highlight=${encodeURIComponent(highlightQuery)}`
                                    : `/orders/${order.id}`
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="route-link rounded-[12px] border border-slate-200 bg-transparent px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                Открыть
                              </Link>

                              {user.role === "admin" ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void removeOrder(order.id);
                                  }}
                                  className="rounded-[12px] border border-rose-200 bg-transparent px-3 py-1.5 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50"
                                >
                                  Удалить
                                </button>
                              ) : null}
                            </div>

                          </div>
                        </div>
                      </td>

                      <td className="border-t border-[#E5E7EB] px-5 py-2.5">
                        <div className="flex flex-col items-start gap-1.5">
                          <span
                            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${orderTypeClasses(
                              orderType
                            )}`}
                          >
                            {orderType}
                          </span>

                          {supplierName ? (
                            <span className="text-[11px] font-medium text-slate-500">
                              {supplierName}
                            </span>
                          ) : null}

                          {overdue ? (
                            <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                              Просрочен
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="border-t border-[#E5E7EB] px-5 py-2.5 text-[14px] text-slate-700">
                        {formatDate(order.order_date)}
                      </td>

                      <td className="border-t border-[#E5E7EB] px-5 py-2.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                              orderStatus
                            )}`}
                          >
                            {orderStatus}
                          </span>
                          {hasCanceledItems ? (
                            <div className="text-[10px] font-medium text-amber-700">
                              Есть отмены
                            </div>
                          ) : null}
                        </div>
                      </td>

                      <td className="border-t border-[#E5E7EB] px-5 py-2.5">
                        <div className="min-w-[160px]">
                          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
                            <span>Готовность</span>
                            <span className="text-slate-700">
                              {progress.delivered}/{progress.total}
                            </span>
                          </div>

                          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
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

                      <td className="border-t border-[#E5E7EB] px-5 py-2.5 text-[14px] text-slate-700">
                        {formatDate(plannedDate)}
                      </td>

                      <td className="border-t border-[#E5E7EB] px-5 py-2.5 text-[14px] text-slate-700">
                        {formatDate(fullDeliveredDate)}
                      </td>

                      <td className="border-t border-[#E5E7EB] px-5 py-2.5">
                        {order.updated_at ? (
                          <div className="max-w-[170px] leading-5">
                            <div className="premium-ui-title text-[13px] text-slate-800">
                              {order.updated_by || "—"}
                            </div>
                            <div className="mt-0.5 text-[12px] leading-5 text-slate-500">
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
                          className="border-t border-[#E5E7EB] bg-slate-50/60 px-5 py-3.5"
                        >
                          <div className="premium-shell rounded-[24px] p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                            <div className="mb-4 flex items-center justify-between">
                              <div>
                                <div className="premium-kicker text-[10px] text-slate-400">
                                  Позиции заказа
                                </div>
                                <div className="premium-subtitle mt-1 text-sm text-slate-500">
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
                                const articleMatched = matchesHighlight(item.article);
                                const replacementMatched = matchesHighlight(item.replacement_article);
                                const nameMatched = matchesHighlight(item.name);
                                const itemMatched = articleMatched || replacementMatched || nameMatched;

                                return (
                                  <div
                                    key={item.id}
                                    className={`premium-card-hover grid grid-cols-[1.05fr_1.6fr_0.55fr_0.9fr_0.8fr_0.8fr_0.8fr] gap-4 rounded-2xl border bg-white px-4 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] ${
                                      itemOverdue
                                        ? "border-rose-200 ring-1 ring-rose-100"
                                        : itemMatched
                                        ? "border-amber-300 ring-2 ring-amber-100 bg-amber-50/30"
                                        : "border-slate-200"
                                    }`}
                                  >
                                    <div>
                                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        Артикул
                                      </div>

                                      <button
                                        onClick={() => copyArticle(item.article)}
                                        className={`rounded px-1 py-0.5 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-100 ${
                                          articleMatched ? "bg-amber-100 ring-1 ring-amber-200" : ""
                                        }`}
                                        title="Нажми, чтобы скопировать артикул"
                                      >
                                        {renderHighlightedText(item.article)}
                                      </button>

                                      {item.replacement_article ? (
                                        <div className="mt-2 space-y-1">
                                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                            Замена
                                          </span>
                                          <div
                                            className={`rounded-xl border border-amber-200 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 ${
                                              replacementMatched ? "bg-amber-100 ring-1 ring-amber-200" : "bg-amber-50"
                                            }`}
                                          >
                                            {renderHighlightedText(item.replacement_article)}
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
                                      <div
                                        className={`rounded-xl px-2 py-1 text-sm leading-6 text-slate-700 ${
                                          nameMatched ? "bg-amber-100 ring-1 ring-amber-200" : ""
                                        }`}
                                      >
                                        {renderHighlightedText(item.name)}
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

                                      {user.role === "viewer" || user.role === "buyer" || hasCanceledItems ? (
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
                                      {item.initial_planned_date &&
                                      item.initial_planned_date !== item.planned_date ? (
                                        <div className="mt-1 text-[10px] leading-4 text-amber-700">
                                          Первая: {formatDate(item.initial_planned_date)}
                                          {item.planned_date_change_count ? (
                                            <span> · переносов: {item.planned_date_change_count}</span>
                                          ) : null}
                                        </div>
                                      ) : null}
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
