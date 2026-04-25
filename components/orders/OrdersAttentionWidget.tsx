"use client";

import Link from "next/link";
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
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  const clampPosition = (x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };

    const buttonWidth = 176;
    const panelWidth = open ? 296 + 12 + buttonWidth : buttonWidth;
    const panelHeight = open ? 420 : 64;
    const maxX = Math.max(12, window.innerWidth - panelWidth - 12);
    const maxY = Math.max(12, window.innerHeight - panelHeight - 12);

    return {
      x: Math.min(Math.max(12, x), maxX),
      y: Math.min(Math.max(96, y), maxY),
    };
  };

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
  if (!ready) return null;

  return (
    <div
      className="fixed z-30 hidden md:block"
      style={{ left: position.x, top: position.y }}
    >
      <div className="relative flex items-start gap-3">
        {open ? (
          <div className="premium-shell w-[296px] rounded-[24px] p-3.5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Фокус дня
                </div>
                <div className="premium-title mt-1.5 text-[18px] font-semibold tracking-tight text-slate-900">
                  Что проверить
                </div>
                <div className="mt-1 text-[12px] leading-5 text-slate-500">
                  Коротко и по делу.
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
                  className="rounded-[18px] border border-stone-200 bg-white px-3 py-2.5 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:bg-stone-50"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                    {card.title}
                  </div>
                  <div className="mt-1 text-[22px] font-semibold tracking-tight text-slate-900">
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
                <div className="rounded-[18px] border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm text-stone-600">
                  Сейчас критичных заказов не видно.
                </div>
              ) : (
                topOrders.map(({ order, reasons, status }) => {
                  const orderType = order.order_type || "Стандартный";

                  return (
                    <div
                      key={order.id}
                      className="rounded-[18px] border border-stone-200 bg-white px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
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

        <div
          className={`premium-shell flex items-center gap-2.5 rounded-full border px-3 py-2.5 shadow-[0_18px_48px_rgba(15,23,42,0.14)] transition ${
            open
              ? "border-stone-300 bg-stone-100 text-stone-800"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          }`}
        >
          <button
            type="button"
            onPointerDown={handleDragStart}
            className="flex h-8 w-8 cursor-grab items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 active:cursor-grabbing"
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3L14.8 8.6L21 9.5L16.5 13.8L17.6 20L12 17.1L6.4 20L7.5 13.8L3 9.5L9.2 8.6L12 3Z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              Фокус дня
            </div>
            <div className="text-[13px] font-semibold">
              {hasAttentionItems ? "Есть приоритеты" : "Всё спокойно"}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            {open ? "Скрыть" : "Открыть"}
          </button>
          {hasAttentionItems ? (
            <div className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              Есть
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
