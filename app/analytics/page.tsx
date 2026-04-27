"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoginForm } from "../../components/orders/LoginForm";
import { EmptyStateCard } from "../../components/ui/EmptyStateCard";
import { MobileBottomNav } from "../../components/ui/MobileBottomNav";
import { MobileLaunchReveal } from "../../components/ui/MobileLaunchReveal";
import { ToastViewport } from "../../components/ui/ToastViewport";
import { AppLogo } from "../../components/ui/AppLogo";
import { useOrdersAuthActions } from "../../lib/auth/useOrdersAuthActions";
import { useProfileAuth } from "../../lib/auth/useProfileAuth";
import { fetchOrders } from "../../lib/orders/api";
import type { OrderWithItems, SupplierSummary } from "../../lib/orders/types";
import { getFriendlyErrorMessage, normalizeToastOptions } from "../../lib/ui/network";
import { useToast } from "../../lib/ui/useToast";
import { fetchSuppliers, mapSuppliers } from "../../lib/suppliers/api";
import {
  buildSupplierAnalytics,
  formatPercent,
  getSupplierAnalyticsTone,
} from "../../lib/suppliers/analytics";

type AnalyticsPeriod = "30d" | "90d" | "180d" | "all";
type OverdueEntry = {
  orderId: number;
  supplierId: number | null;
  firstOverdueAt: string | null;
};

export default function SupplierAnalyticsPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [overdueEntries, setOverdueEntries] = useState<OverdueEntry[]>([]);
  const [period, setPeriod] = useState<AnalyticsPeriod>("90d");
  const [loading, setLoading] = useState(true);

  const { user, setUser, authLoading, profileLoading, setProfileLoading } = useProfileAuth();
  const [loginForm, setLoginForm] = useState({
    login: "",
    password: "",
  });
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
      showToast("Ошибка загрузки аналитики", {
        description: getFriendlyErrorMessage(
          ordersResult.error,
          "Не удалось загрузить заказы для аналитики."
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

  const cutoffDate = useMemo(() => {
    if (period === "all") return null;

    const date = new Date();
    const days = period === "30d" ? 30 : period === "90d" ? 90 : 180;
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }, [period]);

  const filteredOrders = useMemo(() => {
    if (!cutoffDate) return orders;

    return orders.filter((order) => {
      const orderDate = (order.order_date || "").slice(0, 10);
      return !!orderDate && orderDate >= cutoffDate;
    });
  }, [cutoffDate, orders]);

  const filteredHistoricalOverdueBySupplier = useMemo(() => {
    const result: Record<string, number> = {};

    for (const entry of overdueEntries) {
      const overdueDate = (entry.firstOverdueAt || "").slice(0, 10);
      if (cutoffDate && (!overdueDate || overdueDate < cutoffDate)) continue;

      const supplierKey = entry.supplierId ? String(entry.supplierId) : "unassigned";
      result[supplierKey] = (result[supplierKey] || 0) + 1;
    }

    return result;
  }, [cutoffDate, overdueEntries]);

  const analytics = useMemo(
    () =>
      buildSupplierAnalytics({
        orders: filteredOrders,
        suppliers,
        historicalOverdueBySupplier: filteredHistoricalOverdueBySupplier,
      }),
    [filteredHistoricalOverdueBySupplier, filteredOrders, suppliers]
  );

  const rankedRows = useMemo(() => {
    return [...analytics.rows]
      .sort((a, b) => {
        if (b.overdueShare !== a.overdueShare) return b.overdueShare - a.overdueShare;
        if (b.canceledLines !== a.canceledLines) return b.canceledLines - a.canceledLines;
        if (b.totalLines !== a.totalLines) return b.totalLines - a.totalLines;
        return a.supplierName.localeCompare(b.supplierName, "ru");
      })
      .map((row, index) => ({
        ...row,
        rank: index + 1,
        canceledShare: row.totalLines > 0 ? (row.canceledLines / row.totalLines) * 100 : 0,
      }));
  }, [analytics.rows]);

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
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.08)] md:rounded-[28px]">
              <div className="hero-premium px-4 py-4 text-white md:px-8 md:py-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <AppLogo compact showText={false} />
                    <div>
                      <div className="glass-chip inline-flex rounded-full px-3 py-1 text-[11px] text-slate-200">
                        Аналитика поставщиков
                      </div>
                      <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-white md:text-[30px]">
                        Доступ ограничен
                      </h1>
                      <p className="mt-1 text-sm text-slate-300">
                        Поставщик работает только со своими заказами. Сводная аналитика
                        доступна администраторам, покупателям и наблюдателям.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/"
                    className="glass-chip rounded-[14px] px-3 py-2 text-[12px] text-white transition hover:bg-white/10 md:text-[13px]"
                  >
                    К заказам
                  </Link>
                </div>
              </div>
            </div>

            <EmptyStateCard
              title="Аналитика недоступна для роли поставщика"
              description="Если тебе нужен отдельный личный dashboard поставщика, мы можем сделать его следующим этапом."
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

      <div className="min-h-screen bg-slate-100/80 p-2 md:p-8 text-slate-900 antialiased">
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
                        Supplier Analytics
                      </div>

                      <h1 className="premium-ui-title mt-2 text-[22px] text-white md:text-[31px] md:leading-[1.04]">
                        Аналитика поставщиков
                      </h1>

                      <p className="premium-subtitle mt-1 max-w-3xl text-[13px] leading-5 text-slate-300 md:text-[15px] md:leading-6">
                        Общая картина по заказам, линиям, просрочкам и качеству исполнения по каждому поставщику.
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

                  <Link
                    href="/"
                    className="w-full rounded-[14px] bg-white px-4 py-2 text-center text-[12px] font-semibold text-slate-900 transition hover:bg-slate-100 lg:w-auto md:px-4 md:py-2.5 md:text-[13px]"
                  >
                    Вернуться к заказам
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-16 text-center shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              <div className="mt-3 text-sm text-slate-500">Собираем аналитику по поставщикам...</div>
            </div>
          ) : analytics.rows.length === 0 ? (
            <EmptyStateCard
              title="Пока нет данных для аналитики"
              description="Когда в системе появятся заказы с назначенными поставщиками, здесь появится сводка по каждому из них."
            />
          ) : (
            <>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Период анализа
                    </div>
                    <h2 className="mt-1 text-[19px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
                      Выбери срез данных
                    </h2>
                    <p className="mt-1 text-[14px] leading-6 text-slate-500">
                      Фильтр влияет и на заказы, и на первую фиксацию просрочек в аналитике.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "30d", label: "30 дней" },
                      { id: "90d", label: "90 дней" },
                      { id: "180d", label: "180 дней" },
                      { id: "all", label: "За всё время" },
                    ].map((option) => {
                      const active = period === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPeriod(option.id as AnalyticsPeriod)}
                          className={`rounded-[14px] border px-3.5 py-2 text-[13px] font-medium transition ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 md:gap-4">
                <KpiCard
                  title="Поставщиков"
                  value={analytics.overview.suppliersCount}
                  accent="bg-slate-500"
                />
                <KpiCard
                  title="Всего заказов"
                  value={analytics.overview.totalOrders}
                  accent="bg-sky-500"
                />
                <KpiCard
                  title="Всего линий"
                  value={analytics.overview.totalLines}
                  accent="bg-amber-500"
                />
                <KpiCard
                  title="Отменённых заказов"
                  value={analytics.overview.canceledOrders}
                  accent="bg-slate-400"
                />
                <KpiCard
                  title="Отменённых линий"
                  value={analytics.overview.canceledLines}
                  accent="bg-slate-500"
                />
                <KpiCard
                  title="Доля просрочек по линиям"
                  value={formatPercent(analytics.overview.overdueShareTotal)}
                  accent="bg-rose-500"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Структура линий
                      </div>
                      <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
                        По каждому поставщику
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Видно, сколько линий в работе, поставлено, отменено и уже просрочено.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {analytics.rows.map((row) => {
                      const healthyActive = Math.max(row.activeLines - row.overdueLinesCurrent, 0);
                      return (
                        <div key={`composition-${row.supplierId}`} className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {row.supplierName}
                              </div>
                              <div className="text-xs text-slate-500">
                                Заказов: {row.totalOrders} · Линий: {row.totalLines}
                              </div>
                            </div>
                            <div className="text-xs font-medium text-slate-500">
                              Просрочки: {formatPercent(row.overdueShare)}
                            </div>
                          </div>

                          <StackedBar
                            segments={[
                              {
                                label: "В работе",
                                value: healthyActive,
                                color: "bg-sky-500/85",
                              },
                              {
                                label: "Просрочено",
                                value: row.overdueLinesCurrent,
                                color: "bg-rose-500/85",
                              },
                              {
                                label: "Поставлено",
                                value: row.deliveredLines,
                                color: "bg-emerald-500/85",
                              },
                              {
                                label: "Отменено",
                                value: row.canceledLines,
                                color: "bg-slate-400/90",
                              },
                            ]}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Риски и потери
                    </div>
                    <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
                      Просрочки и отмены
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Сравнение доли просроченных и отменённых линий по каждому поставщику.
                    </p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {analytics.rows.map((row) => {
                      const canceledShare =
                        row.totalLines > 0 ? (row.canceledLines / row.totalLines) * 100 : 0;

                      return (
                        <div key={`risk-${row.supplierId}`} className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {row.supplierName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {row.overdueLinesEver} проср. · {row.canceledLines} отмен.
                            </div>
                          </div>

                          <MetricBar
                            label="Просрочки"
                            value={row.overdueShare}
                            color="bg-rose-500"
                          />
                          <MetricBar
                            label="Отмены"
                            value={canceledShare}
                            color="bg-slate-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Рейтинг поставщиков
                    </div>
                    <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
                      Кто работает стабильнее, а кто чаще срывает сроки
                    </h2>
                    <p className="mt-1 text-[14px] leading-6 text-slate-500">
                      Сначала идут поставщики с большей долей просроченных линий, затем с большим числом отмен.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {rankedRows.map((row) => (
                    <div
                      key={`rank-${row.supplierId}`}
                      className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[12px] font-semibold text-white">
                              {row.rank}
                            </div>
                            <div className="truncate text-[16px] font-semibold tracking-tight text-slate-900">
                              {row.supplierName}
                            </div>
                          </div>
                          <div className="mt-2 text-[13px] leading-6 text-slate-500">
                            Заказов: {row.totalOrders} · Линий: {row.totalLines}
                          </div>
                        </div>

                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${getSupplierAnalyticsTone(
                            row
                          )}`}
                        >
                          {formatPercent(row.overdueShare)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <InfoMini label="Просроч. линии" value={row.overdueLinesEver} />
                        <InfoMini label="Отмен. линии" value={row.canceledLines} />
                        <InfoMini label="Доля отмен" value={`${Math.round(row.canceledShare)}%`} />
                        <InfoMini label="Поставлено" value={row.deliveredLines} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Сравнение поставщиков
                    </div>
                    <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[26px]">
                      Дашборд поставщиков
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Историческая доля просрочек считается по линиям и по первой фиксации просрочки, а не по текущей дате в заказе.
                    </p>
                  </div>
                </div>

                <div className="mt-4 hidden overflow-hidden rounded-[22px] border border-slate-200 md:block">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50/90">
                      <tr>
                        {[
                          "Поставщик",
                          "Заказы",
                          "Отмен. заказы",
                          "Линии",
                          "Активные линии",
                          "Поставлено линий",
                          "Отмен. линии",
                          "Просрочено сейчас",
                          "Были просрочки",
                          "Доля просрочек",
                        ].map((label) => (
                          <th
                            key={label}
                            className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {analytics.rows.map((row) => (
                        <tr key={row.supplierId} className="bg-white">
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-slate-900">{row.supplierName}</div>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.totalOrders}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.canceledOrders}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.totalLines}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">
                            {row.activeLines}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">
                            {row.deliveredLines} · {formatPercent(row.deliveredShare)}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.canceledLines}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.overdueLinesCurrent}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.overdueLinesEver}</td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getSupplierAnalyticsTone(
                                row
                              )}`}
                            >
                              {formatPercent(row.overdueShare)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 space-y-3 md:hidden">
                  {analytics.rows.map((row) => (
                    <div
                      key={row.supplierId}
                      className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[16px] font-semibold text-slate-900">
                            {row.supplierName}
                          </div>
                          <div className="mt-1 text-[12px] text-slate-500">
                            Заказов: {row.totalOrders} · Линий: {row.totalLines}
                          </div>
                        </div>

                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${getSupplierAnalyticsTone(
                            row
                          )}`}
                        >
                          {formatPercent(row.overdueShare)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-slate-600">
                        <InfoMini label="Отмен. заказы" value={row.canceledOrders} />
                        <InfoMini label="Активные линии" value={row.activeLines} />
                        <InfoMini label="Поставлено линий" value={row.deliveredLines} />
                        <InfoMini label="Отмен. линии" value={row.canceledLines} />
                        <InfoMini label="Просрочено сейчас" value={row.overdueLinesCurrent} />
                        <InfoMini label="Были просрочки" value={row.overdueLinesEver} />
                      </div>
                    </div>
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
    <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[24px] md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium text-slate-500 md:text-[14px]">{title}</div>
        <div className={`mt-1 h-2 w-2 rounded-full opacity-70 ${accent}`} />
      </div>
      <div className="mt-3 text-[30px] font-semibold tracking-tight text-slate-900 md:text-[36px]">
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
    <div className="rounded-[16px] border border-white/70 bg-white px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold text-slate-900">{value}</div>
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

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
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
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{formatPercent(normalized)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}
