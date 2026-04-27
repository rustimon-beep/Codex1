"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoginForm } from "../../../components/orders/LoginForm";
import { EmptyStateCard } from "../../../components/ui/EmptyStateCard";
import { MobileBottomNav } from "../../../components/ui/MobileBottomNav";
import { MobileLaunchReveal } from "../../../components/ui/MobileLaunchReveal";
import { ToastViewport } from "../../../components/ui/ToastViewport";
import { AppLogo } from "../../../components/ui/AppLogo";
import { useOrdersAuthActions } from "../../../lib/auth/useOrdersAuthActions";
import { useProfileAuth } from "../../../lib/auth/useProfileAuth";
import { fetchOrders } from "../../../lib/orders/api";
import type { OrderItem, OrderWithItems, SupplierSummary } from "../../../lib/orders/types";
import { getFriendlyErrorMessage, normalizeToastOptions } from "../../../lib/ui/network";
import { useToast } from "../../../lib/ui/useToast";
import { fetchSuppliers, mapSuppliers } from "../../../lib/suppliers/api";
import {
  buildSupplierAnalytics,
  formatPercent,
  getSupplierAnalyticsTone,
} from "../../../lib/suppliers/analytics";

type AnalyticsPeriod = "30d" | "90d" | "180d" | "all";
type OverdueEntry = {
  orderId: number;
  supplierId: number | null;
  firstOverdueAt: string | null;
};

type DecoratedOrder = OrderWithItems & {
  overdueLinesCurrent: number;
  canceledLines: number;
  deliveredLines: number;
};

type DecoratedLine = OrderItem & {
  orderClientLabel: string;
  orderId: number;
  isCurrentOverdue: boolean;
  isCanceled: boolean;
};

function getCutoffDate(period: AnalyticsPeriod) {
  if (period === "all") return null;

  const date = new Date();
  const days = period === "30d" ? 30 : period === "90d" ? 90 : 180;
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function isItemCurrentOverdue(item: OrderItem, today: string) {
  const plannedDate = (item.planned_date || "").slice(0, 10);
  const delivered = item.status === "Поставлен" || !!item.delivered_date;
  const canceled = item.status === "Отменен" || !!item.canceled_date;
  return !!plannedDate && plannedDate < today && !delivered && !canceled;
}

export default function SupplierAnalyticsDetailPage() {
  const params = useParams<{ supplierId: string }>();
  const searchParams = useSearchParams();
  const supplierId = params?.supplierId || "";
  const period = (searchParams.get("period") as AnalyticsPeriod) || "90d";

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [overdueEntries, setOverdueEntries] = useState<OverdueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const { user, setUser, authLoading, profileLoading, setProfileLoading } = useProfileAuth();
  const [loginForm, setLoginForm] = useState({ login: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const { toasts, showToast: baseShowToast, closeToast } = useToast();
  const showToast = useCallback(
    (
      title: string,
      options?: { description?: string; variant?: "success" | "error" | "info" }
    ) => {
      baseShowToast(title, normalizeToastOptions(options));
    },
    [baseShowToast]
  );

  const { login, logout } = useOrdersAuthActions({
    loginForm,
    setLoginError,
    setProfileLoading,
    setUser,
    setLoginForm,
    currentUser: user,
    showToast,
  });

  const loadAnalytics = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    const [ordersResult, suppliersResult, historicalResult] = await Promise.all([
      fetchOrders(user),
      fetchSuppliers(),
      fetch("/api/suppliers/analytics")
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ]);

    if (ordersResult.error) {
      showToast("Ошибка загрузки поставщика", {
        description: getFriendlyErrorMessage(
          ordersResult.error,
          "Не удалось загрузить данные по поставщику."
        ),
        variant: "error",
      });
      setLoading(false);
      return;
    }

    setOrders((ordersResult.data as OrderWithItems[]) || []);
    setSuppliers(mapSuppliers((suppliersResult.data as SupplierSummary[]) || []));
    setOverdueEntries((historicalResult?.overdueEntries as OverdueEntry[]) || []);
    setLoading(false);
  }, [showToast, user]);

  useEffect(() => {
    if (user) {
      void loadAnalytics();
    } else {
      setOrders([]);
      setSuppliers([]);
      setOverdueEntries([]);
      setLoading(false);
    }
  }, [loadAnalytics, user]);

  const cutoffDate = useMemo(() => getCutoffDate(period), [period]);

  const supplierOrders = useMemo(() => {
    const filteredBySupplier = orders.filter((order) => {
      const key = order.supplier_id ? String(order.supplier_id) : "unassigned";
      return key === supplierId;
    });

    if (!cutoffDate) return filteredBySupplier;

    return filteredBySupplier.filter((order) => {
      const orderDate = (order.order_date || "").slice(0, 10);
      return !!orderDate && orderDate >= cutoffDate;
    });
  }, [cutoffDate, orders, supplierId]);

  const historicalOverdueBySupplier = useMemo(() => {
    const result: Record<string, number> = {};

    for (const entry of overdueEntries) {
      const overdueDate = (entry.firstOverdueAt || "").slice(0, 10);
      if (cutoffDate && (!overdueDate || overdueDate < cutoffDate)) continue;

      const key = entry.supplierId ? String(entry.supplierId) : "unassigned";
      result[key] = (result[key] || 0) + 1;
    }

    return result;
  }, [cutoffDate, overdueEntries]);

  const supplierSummary = useMemo(() => {
    const rows = buildSupplierAnalytics({
      orders: supplierOrders,
      suppliers,
      historicalOverdueBySupplier,
    }).rows;
    return rows[0] || null;
  }, [historicalOverdueBySupplier, supplierOrders, suppliers]);

  const supplierName = useMemo(() => {
    if (supplierId === "unassigned") return "Без поставщика";
    return (
      suppliers.find((supplier) => String(supplier.id) === supplierId)?.name ||
      supplierSummary?.supplierName ||
      "Поставщик"
    );
  }, [supplierId, suppliers, supplierSummary]);

  const decoratedOrders = useMemo<DecoratedOrder[]>(() => {
    const today = new Date().toISOString().slice(0, 10);

    return [...supplierOrders]
      .map((order) => {
        const items = order.order_items || [];
        return {
          ...order,
          overdueLinesCurrent: items.filter((item) => isItemCurrentOverdue(item, today)).length,
          canceledLines: items.filter(
            (item) => item.status === "Отменен" || !!item.canceled_date
          ).length,
          deliveredLines: items.filter(
            (item) => item.status === "Поставлен" || !!item.delivered_date
          ).length,
        };
      })
      .sort((a, b) => {
        const aDate = (a.order_date || "").slice(0, 10);
        const bDate = (b.order_date || "").slice(0, 10);
        return bDate.localeCompare(aDate);
      });
  }, [supplierOrders]);

  const overdueLines = useMemo<DecoratedLine[]>(() => {
    const today = new Date().toISOString().slice(0, 10);

    return decoratedOrders
      .flatMap((order) =>
        (order.order_items || []).map((item) => ({
          ...item,
          orderClientLabel: order.client_order || `Заказ #${order.id}`,
          orderId: order.id,
          isCurrentOverdue: isItemCurrentOverdue(item, today),
          isCanceled: item.status === "Отменен" || !!item.canceled_date,
        }))
      )
      .filter((item) => item.isCurrentOverdue)
      .sort((a, b) => ((a.planned_date || "") < (b.planned_date || "") ? -1 : 1));
  }, [decoratedOrders]);

  const canceledLines = useMemo<DecoratedLine[]>(() => {
    return decoratedOrders
      .flatMap((order) =>
        (order.order_items || []).map((item) => ({
          ...item,
          orderClientLabel: order.client_order || `Заказ #${order.id}`,
          orderId: order.id,
          isCurrentOverdue: false,
          isCanceled: item.status === "Отменен" || !!item.canceled_date,
        }))
      )
      .filter((item) => item.isCanceled)
      .sort((a, b) => ((b.canceled_date || "") < (a.canceled_date || "") ? -1 : 1));
  }, [decoratedOrders]);

  const handleLogoutWithHaptic = () => {
    void logout();
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <ToastViewport toasts={toasts} onClose={closeToast} />
        <LoginForm
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          loginError={loginError}
          onLogin={login}
        />
      </>
    );
  }

  if (user.role === "supplier") {
    return (
      <>
        <ToastViewport toasts={toasts} onClose={closeToast} />
        <div className="min-h-screen bg-slate-100/80 p-3 md:p-8">
          <div className="mx-auto max-w-5xl">
            <EmptyStateCard
              title="Детальная аналитика недоступна"
              description="Для роли поставщика эта страница сейчас закрыта."
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <MobileLaunchReveal />
      <ToastViewport toasts={toasts} onClose={closeToast} />

      <div className="min-h-screen bg-slate-100/80 p-2 text-slate-900 antialiased md:p-8">
        <div className="bottom-nav-safe mx-auto max-w-7xl space-y-4 md:space-y-6 md:pb-0">
          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.08)] md:rounded-[28px]">
            <div className="hero-premium relative px-3.5 py-3.5 text-white md:px-8 md:py-7">
              <div className="absolute inset-y-0 right-0 w-[36%] bg-[radial-gradient(circle_at_top_right,rgba(180,138,76,0.16),transparent_55%)] pointer-events-none" />
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-4 md:gap-6">
                    <div className="shrink-0 pt-1">
                      <AppLogo compact showText={false} />
                    </div>
                    <div className="min-w-0">
                      <div className="glass-chip inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-medium text-slate-300 md:px-3 md:text-[11px]">
                        Supplier Drill-down
                      </div>
                      <h1 className="premium-ui-title mt-2 text-[22px] text-white md:text-[31px] md:leading-[1.04]">
                        {supplierName}
                      </h1>
                      <p className="premium-subtitle mt-1 max-w-3xl text-[13px] leading-5 text-slate-300 md:text-[15px] md:leading-6">
                        Детальная аналитика поставщика: заказы, линии, просрочки и отмены в выбранном периоде.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col gap-2 lg:min-w-[320px] lg:items-end">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                    <div className="glass-chip rounded-[14px] px-3 py-1.5 text-[12px] text-white md:px-3.5 md:py-2 md:text-[13px]">
                      {profileLoading
                        ? "Загрузка профиля..."
                        : `${user.name} · ${
                            user.role === "admin"
                              ? "Администратор"
                              : user.role === "buyer"
                              ? "Покупатель"
                              : "Наблюдатель"
                          }`}
                    </div>
                    <button
                      onClick={handleLogoutWithHaptic}
                      className="glass-chip rounded-[14px] px-3 py-1.5 text-[12px] font-medium text-slate-100 transition hover:bg-white/10 md:px-3.5 md:py-2 md:text-[13px]"
                    >
                      Выйти
                    </button>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <Link
                      href={`/analytics?period=${period}`}
                      className="rounded-[14px] bg-white px-4 py-2 text-center text-[12px] font-semibold text-slate-900 transition hover:bg-slate-100 md:px-4 md:py-2.5 md:text-[13px]"
                    >
                      К аналитике
                    </Link>
                    <Link
                      href="/"
                      className="rounded-[14px] bg-white/10 px-4 py-2 text-center text-[12px] font-semibold text-white transition hover:bg-white/15 md:px-4 md:py-2.5 md:text-[13px]"
                    >
                      К заказам
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-16 text-center shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              <div className="mt-3 text-sm text-slate-500">Собираем детализацию поставщика...</div>
            </div>
          ) : !supplierSummary ? (
            <EmptyStateCard
              title="Нет данных по поставщику"
              description="В выбранном периоде нет заказов или поставщик пока не привязан к данным."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 md:gap-4">
                <KpiCard title="Заказов" value={supplierSummary.totalOrders} accent="bg-sky-500" />
                <KpiCard title="Активные заказы" value={supplierSummary.activeOrders} accent="bg-slate-500" />
                <KpiCard title="Всего линий" value={supplierSummary.totalLines} accent="bg-amber-500" />
                <KpiCard title="Просроч. линии" value={supplierSummary.overdueLinesEver} accent="bg-rose-500" />
                <KpiCard title="Отмен. линии" value={supplierSummary.canceledLines} accent="bg-slate-400" />
                <KpiCard title="Доля просрочек" value={formatPercent(supplierSummary.overdueShare)} accent="bg-rose-400" />
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[28px] md:px-5 md:py-5">
                  <SectionHeading
                    eyebrow="Итоги"
                    title="Профиль поставщика"
                    description={`Период: ${
                      period === "30d" ? "30 дней" : period === "90d" ? "90 дней" : period === "180d" ? "180 дней" : "за всё время"
                    }.`}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <InfoMini label="Поставлено линий" value={supplierSummary.deliveredLines} />
                    <InfoMini label="Отмен. заказы" value={supplierSummary.canceledOrders} />
                    <InfoMini label="Текущие просрочки" value={supplierSummary.overdueLinesCurrent} />
                    <InfoMini label="Доля поставок" value={formatPercent(supplierSummary.deliveredShare)} />
                  </div>
                  <div className="mt-4">
                    <MetricBar
                      label="Доля просрочек"
                      value={supplierSummary.overdueShare}
                      color="bg-rose-500"
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[28px] md:px-5 md:py-5">
                  <SectionHeading
                    eyebrow="Структура"
                    title="Линии по статусу"
                    description="Видно текущее состояние линий именно по этому поставщику."
                  />
                  <div className="mt-5">
                    <StackedBar
                      segments={[
                        {
                          label: "В работе",
                          value: Math.max(
                            supplierSummary.activeLines - supplierSummary.overdueLinesCurrent,
                            0
                          ),
                          color: "bg-sky-500/85",
                        },
                        {
                          label: "Просрочено",
                          value: supplierSummary.overdueLinesCurrent,
                          color: "bg-rose-500/85",
                        },
                        {
                          label: "Поставлено",
                          value: supplierSummary.deliveredLines,
                          color: "bg-emerald-500/85",
                        },
                        {
                          label: "Отменено",
                          value: supplierSummary.canceledLines,
                          color: "bg-slate-400/90",
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <LinePanel
                  title="Просроченные линии"
                  description="Текущие просрочки, требующие внимания."
                  tone="rose"
                  lines={overdueLines}
                  emptyText="Сейчас у поставщика нет просроченных линий."
                />
                <LinePanel
                  title="Отменённые линии"
                  description="Все линии, которые были отменены в выбранном периоде."
                  tone="slate"
                  lines={canceledLines}
                  emptyText="В выбранном периоде нет отменённых линий."
                />
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[28px] md:px-5 md:py-5">
                <SectionHeading
                  eyebrow="Заказы поставщика"
                  title="Последние заказы"
                  description="Можно быстро перейти в нужный заказ и посмотреть детали."
                />
                <div className="mt-4 hidden max-h-[680px] overflow-auto rounded-[22px] border border-slate-200 md:block">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                      <tr>
                        {["Заказ", "Дата", "Линии", "Поставлено", "Отменено", "Просрочено сейчас"].map(
                          (label) => (
                            <th
                              key={label}
                              className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                            >
                              {label}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {decoratedOrders.map((order) => (
                        <tr key={order.id} className="bg-white transition hover:bg-slate-50/80">
                          <td className="px-4 py-3.5">
                            <Link
                              href={`/orders/${order.id}`}
                              className="font-semibold text-slate-900 transition hover:text-slate-700"
                            >
                              {order.client_order || `Заказ #${order.id}`}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">
                            {formatDate(order.order_date)}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">
                            {order.order_items?.length || 0}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{order.deliveredLines}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{order.canceledLines}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{order.overdueLinesCurrent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 space-y-3 md:hidden">
                  {decoratedOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="block rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.04)]"
                    >
                      <div className="text-[16px] font-semibold tracking-tight text-slate-900">
                        {order.client_order || `Заказ #${order.id}`}
                      </div>
                      <div className="mt-1 text-[12px] text-slate-500">
                        {formatDate(order.order_date)} · Линий: {order.order_items?.length || 0}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <InfoMini label="Поставлено" value={order.deliveredLines} />
                        <InfoMini label="Отменено" value={order.canceledLines} />
                        <InfoMini label="Просрочено" value={order.overdueLinesCurrent} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <MobileBottomNav
        items={[
          {
            label: "Заказы",
            href: "/",
            haptic: "light",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6H20" />
                <path d="M4 12H20" />
                <path d="M4 18H14" />
              </svg>
            ),
          },
          {
            label: "Аналитика",
            href: "/analytics",
            active: true,
            haptic: "light",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19H20" />
                <path d="M7 16V10" />
                <path d="M12 16V5" />
                <path d="M17 16V8" />
              </svg>
            ),
          },
          {
            label: "Выход",
            onClick: handleLogoutWithHaptic,
            tone: "danger",
            haptic: "warning",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 17L15 12L10 7" />
                <path d="M15 12H3" />
                <path d="M21 21V3H12" />
              </svg>
            ),
          },
        ]}
      />
    </>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const safe = value.slice(0, 10);
  const [year, month, day] = safe.split("-");
  if (!year || !month || !day) return safe;
  return `${day}.${month}.${year}`;
}

function KpiCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[24px] md:px-5 md:py-5">
      <div className="flex min-h-[56px] items-start justify-between gap-3">
        <div className="max-w-[85%] text-[12px] font-medium uppercase tracking-[0.06em] leading-5 text-slate-500 md:text-[13px]">
          {title}
        </div>
        <div className={`mt-1 h-2 w-2 rounded-full opacity-70 ${accent}`} />
      </div>
      <div className="mt-auto pt-3 text-[30px] font-semibold tracking-tight text-slate-900 md:text-[36px]">
        {value}
      </div>
    </div>
  );
}

function InfoMini({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-white px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 min-h-[20px] text-[15px] font-semibold leading-5 text-slate-900">
        {value}
      </div>
    </div>
  );
}

function StackedBar({
  segments,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => {
          const width = total > 0 ? (segment.value / total) * 100 : 0;
          return (
            <div
              key={segment.label}
              className={`${segment.color} transition-all`}
              style={{ width: `${width}%` }}
              title={`${segment.label}: ${segment.value}`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-5 text-slate-500">
        {segments.map((segment) => (
          <div key={segment.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${segment.color}`} />
            <span>
              {segment.label}: {segment.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const normalized = Math.max(0, Math.min(value, 100));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[12px] leading-5">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{formatPercent(normalized)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
        {title}
      </h2>
      <p className="mt-1 text-[14px] leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function LinePanel({
  title,
  description,
  tone,
  lines,
  emptyText,
}: {
  title: string;
  description: string;
  tone: "rose" | "slate";
  lines: DecoratedLine[];
  emptyText: string;
}) {
  const wrapperTone =
    tone === "rose" ? "border-rose-200 bg-rose-50/35" : "border-slate-200 bg-slate-50/55";
  const badgeTone =
    tone === "rose" ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-700";

  return (
    <div className={`rounded-[24px] border px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] md:rounded-[28px] md:px-5 md:py-5 ${wrapperTone}`}>
      <SectionHeading eyebrow="Линии" title={title} description={description} />

      <div className="mt-4 space-y-3">
        {lines.length === 0 ? (
          <div className="rounded-[18px] border border-white/80 bg-white/90 px-4 py-6 text-sm text-slate-500">
            {emptyText}
          </div>
        ) : (
          lines.slice(0, 10).map((line) => (
            <Link
              key={`${line.orderId}-${line.id}`}
              href={`/orders/${line.orderId}`}
              className="block rounded-[18px] border border-white/80 bg-white/92 px-4 py-3 transition hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold tracking-tight text-slate-900">
                    {line.article || "Без артикула"} · {line.name || "Без наименования"}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-slate-500">
                    {line.orderClientLabel} · Кол-во: {line.quantity || "—"}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${badgeTone}`}>
                  {tone === "rose" ? formatDate(line.planned_date) : formatDate(line.canceled_date)}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
