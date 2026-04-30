"use client";

import Link from "next/link";
import { type ReactNode, useRef, useState } from "react";
import type { OrderItem, OrderWithItems, UserProfile } from "../../lib/orders/types";
import { triggerHapticFeedback } from "../../lib/ui/haptics";
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
import { STATUS_OPTIONS } from "../../lib/orders/constants";

type OrdersListMobileProps = {
  loading: boolean;
  orders: OrderWithItems[];
  expandedOrders: number[];
  copiedArticle: string | null;
  search: string;
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
  search,
  user,
  toggleOrderExpand,
  removeOrder,
  updateItemStatusQuick,
  copyArticle,
}: OrdersListMobileProps) {
  const highlightQuery = search.trim();
  const normalizedHighlightQuery = highlightQuery.toLowerCase();
  const [swipedOrderId, setSwipedOrderId] = useState<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (
    event: React.TouchEvent<HTMLDivElement>,
    orderId: number
  ) => {
    const touch = event.changedTouches[0];
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (startX === null || startY === null) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0) {
      setSwipedOrderId(orderId);
      triggerHapticFeedback("light");
      return;
    }

    if (swipedOrderId === orderId) {
      setSwipedOrderId(null);
      triggerHapticFeedback("light");
    }
  };

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

  if (loading) {
    return (
      <div className="rounded-[18px] bg-white p-3 text-center text-[12px] text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-slate-200">
        Загрузка...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyStateCard
        compact
        title="Пусто по текущему фильтру"
        description="Сейчас подходящих заказов нет. Попробуй изменить поиск или сбросить фильтры."
      />
    );
  }

  return (
    <div className="route-stage space-y-2">
      {orders.map((order) => {
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
        const actionsWidthClass =
          user.role === "admin" ? "-translate-x-[136px]" : "-translate-x-[74px]";
        const isActionsVisible = swipedOrderId === order.id;

        return (
          <div
            key={order.id}
            className={`premium-card-hover relative overflow-hidden rounded-[18px] border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition md:rounded-[22px] ${
              overdue
                ? "border-rose-200"
                : orderStatus === "Поставлен"
                ? "border-emerald-200"
                : orderType === "Срочный"
                ? "border-amber-200"
                : "border-slate-200"
            }`}
          >
            <div className="absolute inset-y-0 right-0 flex items-center gap-2 px-3">
              <Link
                href={
                  highlightQuery
                    ? `/orders/${order.id}?highlight=${encodeURIComponent(highlightQuery)}`
                    : `/orders/${order.id}`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback("medium");
                }}
                className="route-link flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
                aria-label="Открыть заказ"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 5H19V10" />
                  <path d="M10 14L19 5" />
                  <path d="M19 14V19H5V5H10" />
                </svg>
              </Link>

              {user.role === "admin" ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHapticFeedback("warning");
                    void removeOrder(order.id);
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-[0_12px_24px_rgba(225,29,72,0.2)]"
                  aria-label="Удалить заказ"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6H21" />
                    <path d="M8 6V4H16V6" />
                    <path d="M19 6L18 20H6L5 6" />
                  </svg>
                </button>
              ) : null}
            </div>

            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={(event) => handleTouchEnd(event, order.id)}
              className={`relative bg-white transition-transform duration-300 ${isActionsVisible ? actionsWidthClass : "translate-x-0"}`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(180,138,76,0.07),transparent_65%)]" />
              <div className="pointer-events-none absolute right-3 top-3 h-14 w-14 rounded-full bg-amber-100/60 blur-2xl" />
              <div
                className={`h-1.5 w-full ${
                  overdue
                    ? "bg-rose-500"
                    : orderStatus === "Поставлен"
                    ? "bg-emerald-500"
                    : orderStatus === "Частично поставлен"
                    ? "bg-teal-500"
                    : orderType === "Срочный"
                    ? "bg-violet-500"
                    : orderStatus === "Частично отменен"
                    ? "bg-orange-500"
                    : orderStatus === "Отменен"
                    ? "bg-rose-400"
                    : orderStatus === "В пути"
                    ? "bg-fuchsia-500"
                    : orderStatus === "В работе"
                    ? "bg-sky-500"
                    : "bg-slate-400"
                }`}
              />

              <div className="p-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isActionsVisible) {
                      setSwipedOrderId(null);
                      return;
                    }
                    triggerHapticFeedback("light");
                    toggleOrderExpand(order.id);
                  }}
                  className="block w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
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
                          <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[8px] font-medium text-stone-700 md:text-[9px]">
                            Есть отметки
                          </span>
                        )}

                      </div>

                      {supplierName ? (
                        <div className="mt-1 text-[10px] font-medium text-slate-500 md:text-[11px]">
                          {supplierName}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {overdue ? (
                    <div className="mt-1.5">
                      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[8px] font-medium text-rose-700 md:text-[9px]">
                        Просрочено
                      </span>
                    </div>
                  ) : null}

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

                <div className="mt-2 text-[10px] text-slate-400">
                  {isActionsVisible ? "Свайп вправо, чтобы закрыть быстрые действия" : "Свайп влево для быстрых действий"}
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
                        const articleMatched = matchesHighlight(item.article);
                        const replacementMatched = matchesHighlight(item.replacement_article);
                        const nameMatched = matchesHighlight(item.name);
                        const itemMatched = articleMatched || replacementMatched || nameMatched;

                        return (
                          <div
                            key={item.id}
                            className={`premium-card-hover rounded-[18px] border bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.94))] p-2.5 md:rounded-[22px] md:p-3 ${
                              itemOverdue
                                ? "border-rose-200"
                                : itemMatched
                                ? "border-amber-300 ring-2 ring-amber-100 bg-amber-50/30"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 md:text-[10px]">
                                  Артикул
                                </div>
                                <button
                                  onClick={() => {
                                    triggerHapticFeedback("light");
                                    void copyArticle(item.article);
                                  }}
                                  className={`mt-1 rounded-md px-1 py-0.5 text-left text-[12px] font-semibold text-slate-900 transition hover:bg-white md:text-sm ${
                                    articleMatched ? "bg-amber-100 ring-1 ring-amber-200" : ""
                                  }`}
                                >
                                  {renderHighlightedText(item.article)}
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

                            <div
                              className={`mt-2 rounded-xl px-2 py-1 text-[12px] leading-[1.1rem] text-slate-700 md:text-sm md:leading-5 ${
                                nameMatched ? "bg-amber-100 ring-1 ring-amber-200" : ""
                              }`}
                            >
                              {renderHighlightedText(item.name)}
                            </div>

                            {item.replacement_article ? (
                              <div
                                className={`mt-2 rounded-xl border border-amber-200 px-2.5 py-1.5 text-[9px] font-medium text-amber-700 md:py-2 md:text-[10px] ${
                                  replacementMatched ? "bg-amber-100 ring-1 ring-amber-200" : "bg-amber-50"
                                }`}
                              >
                                <>
                                  Актуальный артикул: {renderHighlightedText(item.replacement_article)}
                                </>
                              </div>
                            ) : null}

                            <div className="mt-2.5 grid grid-cols-2 gap-2.5 md:mt-3 md:gap-3">
                              <MobileInfo label="Кол-во" value={item.quantity || "—"} compact />

                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                  Статус
                                </div>

                                {user.role === "viewer" || user.role === "buyer" || hasCanceledItems ? (
                                  <div className="mt-1 space-y-1">
                                    <span
                                      className={`inline-flex rounded-full px-2 py-1 text-[9px] font-medium md:px-2.5 md:text-[10px] ${statusClasses(
                                        item.status || "Новый"
                                      )}`}
                                    >
                                      {item.status || "Новый"}
                                    </span>
                                    {hasCanceledItems ? (
                                      <div className="text-[9px] font-medium text-amber-700">
                                        Есть отмены
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <select
                                    value={item.status || "Новый"}
                                    onChange={(e) => {
                                      triggerHapticFeedback("light");
                                      void updateItemStatusQuick(order.id, item, e.target.value);
                                    }}
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
                              {item.initial_planned_date &&
                              item.initial_planned_date !== item.planned_date ? (
                                <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[10px] leading-4 text-amber-800">
                                  Первая дата: {formatDate(item.initial_planned_date)}. Новая дата:{" "}
                                  {formatDate(item.planned_date)}
                                  {item.planned_date_change_count ? (
                                    <span> · переносов: {item.planned_date_change_count}</span>
                                  ) : null}
                                </div>
                              ) : null}
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
