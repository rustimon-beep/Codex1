"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LoginForm } from "../../../../components/orders/LoginForm";
import { EmptyStateCard } from "../../../../components/ui/EmptyStateCard";
import { MobileBottomNav } from "../../../../components/ui/MobileBottomNav";
import { MobileLaunchReveal } from "../../../../components/ui/MobileLaunchReveal";
import { ToastViewport } from "../../../../components/ui/ToastViewport";
import { AppLogo } from "../../../../components/ui/AppLogo";
import { useOrdersAuthActions } from "../../../../lib/auth/useOrdersAuthActions";
import { useProfileAuth } from "../../../../lib/auth/useProfileAuth";
import {
  calculateSupplierScore,
  classifySupplier,
  collectSupplierPeriodMetrics,
  compareSupplierPeriods,
} from "../../../../lib/analytics/supplierKpi";
import {
  getAnalyticsCutoffDate,
  getAnalyticsPeriodLabel,
  getAnalyticsPreviousWindow,
  parseAnalyticsPeriod,
  type AnalyticsPeriod,
} from "../../../../lib/analytics/periods";
import { fetchOrders } from "../../../../lib/orders/api";
import type { OrderItem, OrderWithItems, SupplierSummary } from "../../../../lib/orders/types";
import { getFriendlyErrorMessage, normalizeToastOptions } from "../../../../lib/ui/network";
import { useToast } from "../../../../lib/ui/useToast";
import { fetchSuppliers, mapSuppliers } from "../../../../lib/suppliers/api";

type MonthlyPoint = {
  key: string;
  label: string;
  score: number;
  orders: number;
  lines: number;
  delivered: number;
  canceled: number;
  overdue: number;
  averageDelay: number;
};

type ProblemArticle = {
  key: string;
  article: string;
  name: string;
  ordersCount: number;
  canceledCount: number;
  overdueCount: number;
  averageDelay: number;
};

type DecoratedLine = OrderItem & {
  orderId: number;
  clientOrder: string;
  orderDate: string;
  isOverdue: boolean;
  isCanceled: boolean;
  isDelivered: boolean;
  delayDays: number | null;
};

type HistoricalOverdueEntry = {
  orderItemId: number;
};

function normalizeDate(value: string | null | undefined) {
  return (value || "").slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  const safe = normalizeDate(value);
  if (!safe) return "—";
  const [year, month, day] = safe.split("-");
  if (!year || !month || !day) return safe;
  return `${day}.${month}.${year}`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  return `${month}.${year.slice(2)}`;
}

function getMonthKey(value: string | null | undefined) {
  const safe = normalizeDate(value);
  return safe ? safe.slice(0, 7) : "";
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function diffDays(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

function isDelivered(item: OrderItem) {
  return item.status === "Поставлен" || !!item.delivered_date;
}

function isCanceled(item: OrderItem) {
  return item.status === "Отменен" || !!item.canceled_date;
}

function isCurrentOverdue(item: OrderItem, today: string) {
  const plannedDate = normalizeDate(item.planned_date);
  return !!plannedDate && plannedDate < today && !isDelivered(item) && !isCanceled(item);
}

function buildSupplierNameMap(suppliers: SupplierSummary[]) {
  const map = new Map<string, string>();
  suppliers.forEach((supplier) => map.set(String(supplier.id), supplier.name));
  map.set("unassigned", "Без поставщика");
  return map;
}

function buildMonthlyPoints(
  orders: OrderWithItems[],
  today: string,
  historicalOverdueItemIds: Set<number>
) {
  const currentMonth = startOfMonth(new Date());
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = addMonths(currentMonth, -(5 - index));
    const key = date.toISOString().slice(0, 7);
    return key;
  });

  return monthKeys.map((key) => {
    const bucketOrders = orders.filter((order) => getMonthKey(order.order_date) === key);
    const metrics = collectSupplierPeriodMetrics(bucketOrders, today, historicalOverdueItemIds);
    const score = calculateSupplierScore({
      onTimeDelivery: metrics.onTimeDelivery,
      fillRate: metrics.fillRate,
      refusalRate: metrics.refusalRate,
      averageLeadTime: metrics.averageLeadTime,
      communicationScore: metrics.communicationScore,
    }).total;

    return {
      key,
      label: monthLabel(key),
      score,
      orders: bucketOrders.length,
      lines: metrics.totalLines,
      delivered: metrics.deliveredLines,
      canceled: metrics.canceledLines,
      overdue: metrics.overdueLinesCurrent,
      averageDelay: metrics.averageDelay,
    };
  });
}

function buildProblemArticles(orders: OrderWithItems[]) {
  const groups = new Map<string, ProblemArticle>();

  for (const order of orders) {
    for (const item of order.order_items || []) {
      const article = item.article || "—";
      const name = item.name || "Без наименования";
      const key = `${article}__${name}`;
      const plannedDate = normalizeDate(item.planned_date);
      const deliveredDate = normalizeDate(item.delivered_date);
      const canceled = isCanceled(item);
      const overdue = !!plannedDate && ((!deliveredDate && !canceled) || deliveredDate > plannedDate);
      const delayDays =
        plannedDate && deliveredDate && deliveredDate > plannedDate
          ? diffDays(plannedDate, deliveredDate)
          : null;

      const current = groups.get(key) || {
        key,
        article,
        name,
        ordersCount: 0,
        canceledCount: 0,
        overdueCount: 0,
        averageDelay: 0,
      };

      current.ordersCount += 1;
      if (canceled) current.canceledCount += 1;
      if (overdue) current.overdueCount += 1;
      if (delayDays) {
        const totalDelay = current.averageDelay * Math.max(current.overdueCount - 1, 0) + delayDays;
        current.averageDelay = totalDelay / current.overdueCount;
      }

      groups.set(key, current);
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => {
      if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
      if (b.canceledCount !== a.canceledCount) return b.canceledCount - a.canceledCount;
      return b.ordersCount - a.ordersCount;
    })
    .slice(0, 10);
}

export default function SupplierAnalyticsDetailPage() {
  const params = useParams<{ supplierId: string }>();
  const searchParams = useSearchParams();
  const supplierId = params?.supplierId || "";
  const period = parseAnalyticsPeriod(searchParams.get("period"));

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [historicalOverdueEntries, setHistoricalOverdueEntries] = useState<HistoricalOverdueEntry[]>([]);
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
    const [ordersResult, suppliersResult, overdueResult] = await Promise.all([
      fetchOrders(user),
      fetchSuppliers(),
      fetch("/api/suppliers/analytics", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) {
          throw new Error("Не удалось загрузить журнал просрочек.");
        }
        return response.json();
      }),
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
    setHistoricalOverdueEntries((overdueResult.overdueEntries as HistoricalOverdueEntry[]) || []);
    setLoading(false);
  }, [showToast, user]);

  useEffect(() => {
    if (user) {
      void loadAnalytics();
    } else {
      setOrders([]);
      setSuppliers([]);
      setHistoricalOverdueEntries([]);
      setLoading(false);
    }
  }, [loadAnalytics, user]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const historicalOverdueItemIds = useMemo(
    () => new Set(historicalOverdueEntries.map((entry) => entry.orderItemId)),
    [historicalOverdueEntries]
  );
  const cutoffDate = useMemo(() => getAnalyticsCutoffDate(period), [period]);
  const previousWindow = useMemo(() => getAnalyticsPreviousWindow(period), [period]);
  const supplierNameMap = useMemo(() => buildSupplierNameMap(suppliers), [suppliers]);

  const allSupplierOrders = useMemo(() => {
    return orders.filter((order) => {
      const key = order.supplier_id ? String(order.supplier_id) : "unassigned";
      return key === supplierId;
    });
  }, [orders, supplierId]);

  const supplierOrders = useMemo(() => {
    if (!cutoffDate) return allSupplierOrders;

    return allSupplierOrders.filter((order) => {
      const orderDate = normalizeDate(order.order_date);
      return !!orderDate && orderDate >= cutoffDate;
    });
  }, [allSupplierOrders, cutoffDate]);

  const previousOrders = useMemo(() => {
    if (!previousWindow.previousStart || !previousWindow.previousEnd) return [];

    return allSupplierOrders.filter((order) => {
      const orderDate = normalizeDate(order.order_date);
      return !!orderDate && orderDate >= previousWindow.previousStart! && orderDate <= previousWindow.previousEnd!;
    });
  }, [allSupplierOrders, previousWindow.previousEnd, previousWindow.previousStart]);

  const supplierName = useMemo(() => {
    return supplierNameMap.get(supplierId) || "Поставщик";
  }, [supplierId, supplierNameMap]);

  const metrics = useMemo(
    () => collectSupplierPeriodMetrics(supplierOrders, today, historicalOverdueItemIds),
    [historicalOverdueItemIds, supplierOrders, today]
  );
  const previousMetrics = useMemo(
    () => collectSupplierPeriodMetrics(previousOrders, today, historicalOverdueItemIds),
    [historicalOverdueItemIds, previousOrders, today]
  );

  const score = useMemo(
    () =>
      calculateSupplierScore({
        onTimeDelivery: metrics.onTimeDelivery,
        fillRate: metrics.fillRate,
        refusalRate: metrics.refusalRate,
        averageLeadTime: metrics.averageLeadTime,
        communicationScore: metrics.communicationScore,
      }),
    [metrics]
  );

  const previousScore = useMemo(
    () =>
      calculateSupplierScore({
        onTimeDelivery: previousMetrics.onTimeDelivery,
        fillRate: previousMetrics.fillRate,
        refusalRate: previousMetrics.refusalRate,
        averageLeadTime: previousMetrics.averageLeadTime,
        communicationScore: previousMetrics.communicationScore,
      }),
    [previousMetrics]
  );

  const scoreTrend = useMemo(
    () => compareSupplierPeriods(score.total, previousScore.total),
    [previousScore.total, score.total]
  );

  const supplierClass = useMemo(() => classifySupplier(score.total), [score.total]);

  const monthlyPoints = useMemo(
    () => buildMonthlyPoints(allSupplierOrders, today, historicalOverdueItemIds),
    [allSupplierOrders, historicalOverdueItemIds, today]
  );

  const decoratedLines = useMemo<DecoratedLine[]>(() => {
    return supplierOrders.flatMap((order) =>
      (order.order_items || []).map((item) => {
        const plannedDate = normalizeDate(item.planned_date);
        const deliveredDate = normalizeDate(item.delivered_date);
        return {
          ...item,
          orderId: order.id,
          clientOrder: order.client_order || `Заказ #${order.id}`,
          orderDate: normalizeDate(order.order_date),
          isOverdue: isCurrentOverdue(item, today),
          isCanceled: isCanceled(item),
          isDelivered: isDelivered(item),
          delayDays:
            plannedDate && deliveredDate && deliveredDate > plannedDate
              ? diffDays(plannedDate, deliveredDate)
              : null,
        };
      })
    );
  }, [supplierOrders, today]);

  const overdueLines = useMemo(
    () =>
      decoratedLines
        .filter((line) => line.isOverdue)
        .sort((a, b) => normalizeDate(a.planned_date).localeCompare(normalizeDate(b.planned_date))),
    [decoratedLines]
  );

  const canceledLines = useMemo(
    () =>
      decoratedLines
        .filter((line) => line.isCanceled)
        .sort((a, b) => normalizeDate(b.canceled_date).localeCompare(normalizeDate(a.canceled_date))),
    [decoratedLines]
  );

  const problemArticles = useMemo(() => buildProblemArticles(supplierOrders), [supplierOrders]);

  const activeOrders = useMemo(() => {
    return supplierOrders.filter((order) =>
      (order.order_items || []).some((item) => !isDelivered(item) && !isCanceled(item))
    ).length;
  }, [supplierOrders]);

  const statusStructure = useMemo(() => {
    const healthyActive = Math.max(
      metrics.totalLines - metrics.deliveredLines - metrics.canceledLines - metrics.overdueLinesCurrent,
      0
    );
    return [
      { label: "В работе", value: healthyActive, color: "#0F766E" },
      { label: "Просрочено", value: metrics.overdueLinesCurrent, color: "#DC2626" },
      { label: "Поставлено", value: metrics.deliveredLines, color: "#16A34A" },
      { label: "Отказано", value: metrics.canceledLines, color: "#64748B" },
    ];
  }, [metrics.canceledLines, metrics.deliveredLines, metrics.overdueLinesCurrent, metrics.totalLines]);

  const compareHref = `/analytics/suppliers/compare?suppliers=${supplierId}&period=${period}`;

  const handleLogout = () => {
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
              title="Детальная аналитика поставщиков недоступна"
              description="Для роли поставщика этот блок не нужен, поэтому оставляем его закрытым."
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

      <div className="min-h-screen bg-[#F5F7FA] p-2 text-slate-900 antialiased md:p-8">
        <div className="bottom-nav-safe mx-auto max-w-7xl space-y-4 md:space-y-6 md:pb-0">
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
            <div className="relative bg-[linear-gradient(180deg,#151A22_0%,#111827_100%)] px-4 py-4 text-white md:px-8 md:py-7">
              <div className="absolute inset-y-0 right-0 w-[34%] bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.12),transparent_58%)] pointer-events-none" />
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4 md:gap-6">
                  <div className="shrink-0 pt-1">
                    <AppLogo compact showText={false} />
                  </div>
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">
                      Карточка поставщика
                    </div>
                    <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-white md:text-[32px]">
                      {supplierName}
                    </h1>
                    <p className="mt-1 max-w-3xl text-[14px] leading-6 text-slate-300">
                      Ключевые показатели, рейтинг, динамика по месяцам, проблемные артикулы и рабочая детализация по выбранному поставщику.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:min-w-[360px] lg:items-end">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                    <div className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white md:px-3.5 md:py-2 md:text-[13px]">
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
                      onClick={handleLogout}
                      className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-slate-100 transition hover:bg-white/10 md:px-3.5 md:py-2 md:text-[13px]"
                    >
                      Выйти
                    </button>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <Link
                      href={`/analytics/suppliers?period=${period}`}
                      className="rounded-[14px] bg-white px-4 py-2 text-center text-[12px] font-semibold text-slate-900 transition hover:bg-slate-100 md:px-4 md:py-2.5 md:text-[13px]"
                    >
                      К рейтингу
                    </Link>
                    <Link
                      href={compareHref}
                      className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-2 text-center text-[12px] font-semibold text-white transition hover:bg-white/10 md:px-4 md:py-2.5 md:text-[13px]"
                    >
                      Сравнить
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
          ) : !supplierOrders.length ? (
            <EmptyStateCard
              title="Нет данных по поставщику"
              description="В выбранном периоде нет заказов или поставщик пока не привязан к данным."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                <KpiCard title="Рейтинг" value={Math.round(score.total)} accent="bg-teal-500" />
                <KpiCard title="Класс" value={supplierClass} accent="bg-slate-500" subtitle={getClassLabel(supplierClass)} />
                <KpiCard
                  title="Изменение к прошлому периоду"
                  value={formatSigned(scoreTrend.delta)}
                  accent={scoreTrend.direction === "down" ? "bg-rose-500" : scoreTrend.direction === "up" ? "bg-emerald-500" : "bg-slate-400"}
                />
                <KpiCard title="Активные заказы" value={activeOrders} accent="bg-sky-500" />
                <KpiCard title="Были в просрочке" value={metrics.overdueLinesEver} accent="bg-rose-500" />
                <KpiCard title="Отказы" value={metrics.canceledLines} accent="bg-slate-400" />
                <KpiCard title="Средний срок" value={metrics.averageLeadTime ? `${metrics.averageLeadTime} дн.` : "—"} accent="bg-amber-500" />
                <KpiCard title="Период" value={getAnalyticsPeriodLabel(period)} accent="bg-slate-500" />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <CardSection eyebrow="Рейтинг" title="Динамика рейтинга по месяцам" description="Показывает, как общий рейтинг поставщика менялся от месяца к месяцу.">
                  <LineTrendChart
                    data={monthlyPoints.map((point) => ({ label: point.label, value: point.score }))}
                    color="#14B8A6"
                  />
                </CardSection>

                <CardSection eyebrow="Нагрузка" title="Заказы и строки по месяцам" description="Сколько заказов и строк приходилось на поставщика каждый месяц.">
                  <MonthlyDualBars data={monthlyPoints} />
                </CardSection>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <CardSection eyebrow="Качество исполнения" title="Выполнено / отказано / просрочено" description="Структура линий по месяцам — где теряется качество исполнения.">
                  <MonthlyStackedStatusChart data={monthlyPoints} />
                </CardSection>

                <CardSection eyebrow="Задержки" title="Средняя просрочка по месяцам" description="Средняя задержка считается только по тем линиям, где delivered_date позже planned_date.">
                  <LineTrendChart
                    data={monthlyPoints.map((point) => ({ label: point.label, value: point.averageDelay }))}
                    color="#DC2626"
                  />
                </CardSection>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <CardSection eyebrow="Структура статусов" title="Текущее состояние линий" description="Компактный срез по текущим статусам строк у поставщика.">
                  <DonutStatusCard segments={statusStructure} total={metrics.totalLines} />
                </CardSection>

                <CardSection eyebrow="Показатели поставщика" title="Ключевые показатели" description="Верхнеуровневый профиль качества работы поставщика в текущем периоде.">
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoMini label="Поставка в срок" value={formatPercent(metrics.onTimeDelivery)} />
                    <InfoMini label="Исполнение" value={formatPercent(metrics.fillRate)} />
                    <InfoMini label="Доля отказов" value={formatPercent(metrics.refusalRate)} />
                    <InfoMini label="Средняя задержка" value={metrics.averageDelay ? `${metrics.averageDelay} дн.` : "—"} />
                    <InfoMini label="Исполнено строк" value={metrics.deliveredLines} />
                    <InfoMini label="Всего строк" value={metrics.totalLines} />
                  </div>

                  <div className="mt-4 space-y-3">
                    <MetricBar label="Поставка в срок" value={metrics.onTimeDelivery} color="bg-teal-500" />
                    <MetricBar label="Исполнение" value={metrics.fillRate} color="bg-emerald-500" />
                    <MetricBar label="Доля отказов" value={metrics.refusalRate} color="bg-slate-500" />
                  </div>
                </CardSection>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <LinesPanel
                  title="Просроченные строки"
                  description="Текущие активные просрочки, которые требуют ручного контроля."
                  tone="rose"
                  lines={overdueLines}
                  emptyText="Сейчас у поставщика нет активных просроченных строк."
                />
                <LinesPanel
                  title="Отказанные строки"
                  description="Все строки, которые были отменены или ушли в отказ в выбранном периоде."
                  tone="slate"
                  lines={canceledLines}
                  emptyText="В выбранном периоде нет отказанных строк."
                />
              </div>

              <CardSection eyebrow="Проблемные артикулы" title="Топ проблемных артикулов" description="Артикулы, по которым чаще всего возникают просрочки, отмены и задержки.">
                <ProblemArticlesTable rows={problemArticles} />
              </CardSection>

              <CardSection eyebrow="Заказы поставщика" title="Последние заказы" description="Быстрый переход к реальным заказам, которые формируют ключевые показатели поставщика.">
                <RecentOrdersTable orders={supplierOrders} today={today} />
              </CardSection>
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
            href: "/analytics/suppliers",
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
            onClick: handleLogout,
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

function getClassLabel(value: string) {
  switch (value) {
    case "A":
      return "отличный";
    case "B":
      return "надежный";
    case "C":
      return "нестабильный";
    case "D":
      return "проблемный";
    default:
      return "";
  }
}

function formatSigned(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) return `+${rounded}`;
  return `${rounded}`;
}

function KpiCard({
  title,
  value,
  accent,
  subtitle,
}: {
  title: string;
  value: number | string;
  accent: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:px-5 md:py-5">
      <div className="flex min-h-[58px] items-start justify-between gap-3">
        <div className="max-w-[80%] text-[12px] font-medium uppercase tracking-[0.06em] leading-5 text-slate-500 md:text-[13px]">
          {title}
        </div>
        <div className={`mt-1 h-2.5 w-2.5 rounded-full opacity-80 ${accent}`} />
      </div>
      <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-900 md:text-[34px]">
        {value}
      </div>
      {subtitle ? <div className="mt-1 text-[12px] text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

function CardSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:px-5 md:py-5">
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <div className="mt-5">{children}</div>
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
        <span className="font-semibold text-slate-900">{Math.round(normalized)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}

function LineTrendChart({
  data,
  color,
}: {
  data: Array<{ label: string; value: number }>;
  color: string;
}) {
  const points = data.map((entry) => entry.value);
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const width = 520;
  const height = 180;

  const path = data
    .map((entry, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * (width - 32) + 16;
      const y = height - 20 - ((entry.value - min) / range) * (height - 40);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        {data.map((entry, index) => {
          const x = (index / Math.max(data.length - 1, 1)) * (width - 32) + 16;
          const y = height - 20 - ((entry.value - min) / range) * (height - 40);
          return (
            <g key={entry.label}>
              <circle cx={x} cy={y} r="4" fill={color} />
            </g>
          );
        })}
      </svg>
      <div className="grid grid-cols-6 gap-2 text-[11px] text-slate-500">
        {data.map((entry) => (
          <div key={entry.label} className="text-center">
            <div className="font-medium text-slate-700">{Math.round(entry.value)}</div>
            <div>{entry.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyDualBars({ data }: { data: MonthlyPoint[] }) {
  const max = Math.max(...data.map((point) => Math.max(point.orders, point.lines)), 1);

  return (
    <div className="grid grid-cols-6 gap-3">
      {data.map((point) => (
        <div key={point.key} className="space-y-2">
          <div className="flex h-40 items-end justify-center gap-2 rounded-[18px] border border-slate-100 bg-slate-50/70 px-3 pb-3 pt-4">
            <div className="flex w-5 items-end">
              <div
                className="w-full rounded-t-full bg-slate-400"
                style={{ height: `${(point.orders / max) * 100}%` }}
                title={`Заказы: ${point.orders}`}
              />
            </div>
            <div className="flex w-5 items-end">
              <div
                className="w-full rounded-t-full bg-teal-500"
                style={{ height: `${(point.lines / max) * 100}%` }}
                title={`Строки: ${point.lines}`}
              />
            </div>
          </div>
          <div className="text-center text-[11px] text-slate-500">
            <div className="font-medium text-slate-700">{point.label}</div>
            <div>{point.orders} / {point.lines}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthlyStackedStatusChart({ data }: { data: MonthlyPoint[] }) {
  const max = Math.max(...data.map((point) => point.lines), 1);

  return (
    <div className="space-y-4">
      {data.map((point) => {
        const delivered = point.delivered;
        const canceled = point.canceled;
        const overdue = point.overdue;
        const active = Math.max(point.lines - delivered - canceled - overdue, 0);

        return (
          <div key={point.key}>
            <div className="mb-1 flex items-center justify-between text-[12px] text-slate-500">
              <span>{point.label}</span>
              <span>{point.lines} строк</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {[
                { value: active, color: "bg-teal-600" },
                { value: overdue, color: "bg-rose-500" },
                { value: delivered, color: "bg-emerald-500" },
                { value: canceled, color: "bg-slate-400" },
              ].map((segment, index) => (
                <div
                  key={`${point.key}-${index}`}
                  className={segment.color}
                  style={{ width: `${(segment.value / max) * 100}%` }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutStatusCard({
  segments,
  total,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const safeTotal = Math.max(total, 1);
  let current = 0;
  const gradient = segments
    .map((segment) => {
      const start = (current / safeTotal) * 100;
      current += segment.value;
      const end = (current / safeTotal) * 100;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
      <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgba(229,231,235,1)]">
          <div className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Всего линий</div>
          <div className="mt-1 text-[32px] font-semibold tracking-tight text-slate-900">{total}</div>
        </div>
      </div>

      <div className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-sm font-medium text-slate-700">{segment.label}</span>
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {segment.value} · {Math.round((segment.value / safeTotal) * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinesPanel({
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
    <div className={`rounded-[24px] border px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] md:px-5 md:py-5 ${wrapperTone}`}>
      <SectionHeading eyebrow="Строки" title={title} description={description} />
      <div className="mt-4 space-y-3">
        {lines.length === 0 ? (
          <div className="rounded-[18px] border border-white/80 bg-white/90 px-4 py-6 text-sm text-slate-500">
            {emptyText}
          </div>
        ) : (
          lines.slice(0, 12).map((line) => (
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
                    {line.clientOrder} · Кол-во: {line.quantity || "—"}
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

function ProblemArticlesTable({ rows }: { rows: ProblemArticle[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
        По текущему периоду проблемных артикулов не найдено.
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-slate-200">
      <div className="hidden overflow-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50/95">
            <tr>
              {["Артикул", "Наименование", "Заказов", "Отказов", "Просрочек", "Средняя задержка"].map((label) => (
                <th key={label} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr key={row.key} className="bg-white">
                <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">{row.article}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{row.name}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{row.ordersCount}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{row.canceledCount}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{row.overdueCount}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">
                  {row.averageDelay ? `${Math.round(row.averageDelay * 10) / 10} дн.` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {rows.map((row) => (
          <div key={row.key} className="rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="text-[15px] font-semibold text-slate-900">{row.article}</div>
            <div className="mt-0.5 text-[12px] text-slate-500">{row.name}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <InfoMini label="Заказов" value={row.ordersCount} />
              <InfoMini label="Отказов" value={row.canceledCount} />
              <InfoMini label="Просрочек" value={row.overdueCount} />
              <InfoMini
                label="Средняя задержка"
                value={row.averageDelay ? `${Math.round(row.averageDelay * 10) / 10} дн.` : "—"}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentOrdersTable({
  orders,
  today,
}: {
  orders: OrderWithItems[];
  today: string;
}) {
  const rows = [...orders]
    .map((order) => {
      const items = order.order_items || [];
      return {
        ...order,
        deliveredLines: items.filter((item) => isDelivered(item)).length,
        canceledLines: items.filter((item) => isCanceled(item)).length,
        overdueLines: items.filter((item) => isCurrentOverdue(item, today)).length,
      };
    })
    .sort((a, b) => normalizeDate(b.order_date).localeCompare(normalizeDate(a.order_date)));

  return (
    <div className="rounded-[20px] border border-slate-200">
      <div className="hidden max-h-[620px] overflow-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
            <tr>
              {["Заказ", "Дата", "Тип", "Линий", "Поставлено", "Отказано", "Просрочено сейчас"].map((label) => (
                <th key={label} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((order) => (
              <tr key={order.id} className="bg-white transition hover:bg-slate-50/80">
                <td className="px-4 py-3.5">
                  <Link href={`/orders/${order.id}`} className="font-semibold text-slate-900 transition hover:text-slate-700">
                    {order.client_order || `Заказ #${order.id}`}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{formatDate(order.order_date)}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{order.order_type || "Стандартный"}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{order.order_items?.length || 0}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{order.deliveredLines}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{order.canceledLines}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{order.overdueLines}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {rows.map((order) => (
          <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="text-[15px] font-semibold text-slate-900">
              {order.client_order || `Заказ #${order.id}`}
            </div>
            <div className="mt-1 text-[12px] text-slate-500">
              {formatDate(order.order_date)} · {order.order_type || "Стандартный"}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <InfoMini label="Поставлено" value={order.deliveredLines} />
              <InfoMini label="Отказано" value={order.canceledLines} />
              <InfoMini label="Просрочено" value={order.overdueLines} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
