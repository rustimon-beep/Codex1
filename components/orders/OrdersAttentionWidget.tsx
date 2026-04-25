"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  const clampPosition = (x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };

    const buttonWidth = 62;
    const panelWidth = open ? 296 + 12 + buttonWidth : buttonWidth;
    const panelHeight = open ? 346 : 62;
    const maxX = Math.max(12, window.innerWidth - panelWidth - 12);
    const maxY = Math.max(12, window.innerHeight - panelHeight - 12);

    return {
      x: Math.min(Math.max(12, x), maxX),
      y: Math.min(Math.max(96, y), maxY),
    };
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem("orders-attention-widget-position");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { x: number; y: number };
        setPosition(clampPosition(parsed.x, parsed.y));
        setReady(true);
        return;
      } catch {}
    }

    const defaultX = window.innerWidth - 210;
    const defaultY = Math.max(140, Math.round(window.innerHeight * 0.36));
    setPosition(clampPosition(defaultX, defaultY));
    setReady(true);
  }, [open]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    window.localStorage.setItem("orders-attention-widget-position", JSON.stringify(position));
  }, [position, ready]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      setPosition(clampPosition(event.clientX - dragOffsetRef.current.x, event.clientY - dragOffsetRef.current.y));
    };

    const handleUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [open]);

  const handleDragStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  };

  const topOrders = useMemo(() => topAttentionOrders.slice(0, 2), [topAttentionOrders]);
  if (!ready || !mounted) return null;

  return createPortal(
    <div
      className="fixed z-30 hidden md:block"
      style={{ left: position.x, top: position.y }}
    >
      <div className="relative flex items-start gap-3">
        {open ? (
          <div className="premium-shell w-[276px] origin-right rounded-[22px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(247,244,239,0.95))] p-3 shadow-[0_24px_80px_rgba(15,23,42,0.18)] transition-all duration-200 ease-out animate-[attentionWidgetIn_180ms_ease-out]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Фокус дня
                </div>
                <div className="premium-title mt-1 text-[17px] font-semibold tracking-tight text-slate-900">
                  Что проверить
                </div>
                <div className="mt-1 text-[11px] leading-4.5 text-slate-500">
                  Только самое важное.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={handleDragStart}
                  className="cursor-grab rounded-full border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-50 active:cursor-grabbing"
                  aria-label="Переместить фокус дня"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M7 5H7.01" />
                    <path d="M13 5H13.01" />
                    <path d="M7 10H7.01" />
                    <path d="M13 10H13.01" />
                    <path d="M7 15H7.01" />
                    <path d="M13 15H13.01" />
                  </svg>
                </button>
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
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {cards.slice(0, 2).map((card) => (
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
                  className="rounded-[16px] border border-stone-200 bg-white px-3 py-2 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:bg-stone-50"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                    {card.title}
                  </div>
                  <div className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900">
                    {card.count}
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-slate-500">
                    {card.description}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {topOrders.length === 0 ? (
                <div className="rounded-[16px] border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm text-stone-600">
                  Сейчас критичных заказов не видно.
                </div>
              ) : (
                topOrders.map(({ order, reasons, status }) => {
                  const orderType = order.order_type || "Стандартный";

                  return (
                    <div
                      key={order.id}
                      className="rounded-[16px] border border-stone-200 bg-white px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold tracking-tight text-slate-900">
                            {order.client_order || "Без номера"}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${orderTypeClasses(
                                orderType
                              )}`}
                            >
                              {orderType}
                            </span>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${statusClasses(
                                status
                              )}`}
                            >
                              {status}
                            </span>
                          </div>
                        </div>

                        <Link
                          href={`/orders/${order.id}`}
                          className="route-link rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[10px] font-medium text-stone-700 transition hover:bg-stone-100"
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
          className={`group flex h-[62px] w-[62px] items-center justify-center rounded-full border transition ${
            open
              ? "border-stone-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,244,246,0.96))] text-stone-800 shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
              : "border-stone-200 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.98),rgba(244,244,245,0.96)_55%,rgba(231,229,228,0.96))] text-stone-700 shadow-[0_18px_48px_rgba(15,23,42,0.12)] hover:scale-[1.03] hover:shadow-[0_22px_54px_rgba(15,23,42,0.16)]"
          }`}
          aria-label={open ? "Скрыть список внимания" : "Открыть список внимания"}
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_20px_rgba(15,23,42,0.08)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1">
              <path d="M12 7V13" />
              <path d="M12 17H12.01" />
            </svg>
            {hasAttentionItems ? (
              <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border border-white bg-[radial-gradient(circle_at_30%_30%,#fde68a,#f59e0b)] shadow-[0_0_0_4px_rgba(245,158,11,0.12)]" />
            ) : null}
          </div>
        </button>
        <button
          type="button"
          onPointerDown={handleDragStart}
          className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-grab items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-[0_8px_18px_rgba(15,23,42,0.08)] active:cursor-grabbing"
          aria-label="Переместить виджет внимания"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 5H7.01" />
            <path d="M13 5H13.01" />
            <path d="M7 10H7.01" />
            <path d="M13 10H13.01" />
            <path d="M7 15H7.01" />
            <path d="M13 15H13.01" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
}
