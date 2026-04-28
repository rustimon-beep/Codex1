"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  type SupplierClass,
} from "../../../../lib/analytics/supplierKpi";
import {
  getAnalyticsCutoffDate,
  getAnalyticsPeriodLabel,
  parseAnalyticsPeriod,
  type AnalyticsPeriod,
} from "../../../../lib/analytics/periods";
import { fetchOrders } from "../../../../lib/orders/api";
import type { OrderWithItems, SupplierSummary } from "../../../../lib/orders/types";
import { getFriendlyErrorMessage, normalizeToastOptions } from "../../../../lib/ui/network";
import { useToast } from "../../../../lib/ui/useToast";
import { fetchSuppliers, mapSuppliers } from "../../../../lib/suppliers/api";

type CompareRow = {
  supplierId: string;
  supplierName: string;
  score: number;
  supplierClass: SupplierClass;
  totalOrders: number;
  totalLines: number;
  deliveredLines: number;
  canceledLines: number;
  overdueLinesCurrent: number;
  onTimeDelivery: number;
  fillRate: number;
  refusalRate: number;
  averageLeadTime: number;
  averageDelay: number;
  stability: number;
};

function normalizeDate(value: string | null | undefined) {
  return (value || "").slice(0, 10);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function getSupplierNameMap(suppliers: SupplierSummary[]) {
  const map = new Map<string, string>();
  suppliers.forEach((supplier) => map.set(String(supplier.id), supplier.name));
  map.set("unassigned", "Без поставщика");
  return map;
}

function buildCompareRows(params: {
  orders: OrderWithItems[];
  suppliers: SupplierSummary[];
  selectedIds: string[];
  today: string;
}) {
  const { orders, suppliers, selectedIds, today } = params;
  const supplierNameMap = getSupplierNameMap(suppliers);

  return selectedIds
    .map((supplierId) => {
      const supplierOrders = orders.filter((order) => {
        const key = order.supplier_id ? String(order.supplier_id) : "unassigned";
        return key === supplierId;
      });
      const metrics = collectSupplierPeriodMetrics(supplierOrders, today);
      if (!metrics.totalLines) return null;

      const score = calculateSupplierScore({
        onTimeDelivery: metrics.onTimeDelivery,
        fillRate: metrics.fillRate,
        refusalRate: metrics.refusalRate,
        averageLeadTime: metrics.averageLeadTime,
        communicationScore: metrics.communicationScore,
      });

      return {
        supplierId,
        supplierName: supplierNameMap.get(supplierId) || `Поставщик #${supplierId}`,
        score: score.total,
        supplierClass: classifySupplier(score.total),
        totalOrders: metrics.totalOrders,
        totalLines: metrics.totalLines,
        deliveredLines: metrics.deliveredLines,
        canceledLines: metrics.canceledLines,
        overdueLinesCurrent: metrics.overdueLinesCurrent,
        onTimeDelivery: metrics.onTimeDelivery,
        fillRate: metrics.fillRate,
        refusalRate: metrics.refusalRate,
        averageLeadTime: metrics.averageLeadTime,
        averageDelay: metrics.averageDelay,
        stability: Math.max(0, 100 - metrics.refusalRate - (metrics.overdueLinesCurrent / Math.max(metrics.totalLines, 1)) * 100),
      } satisfies CompareRow;
    })
    .filter(Boolean) as CompareRow[];
}

function getBestValue(rows: CompareRow[], key: keyof CompareRow, smallerIsBetter = false) {
  const values = rows.map((row) => Number(row[key]) || 0);
  return smallerIsBetter ? Math.min(...values) : Math.max(...values);
}

export default function SupplierComparePage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const period = parseAnalyticsPeriod(searchParams.get("period"));
  const selectedIds = (searchParams.get("suppliers") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5);

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
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

  const updateSuppliersQuery = useCallback(
    (ids: string[], nextPeriod = period) => {
      const params = new URLSearchParams(searchParams.toString());
      if (ids.length) {
        params.set("suppliers", ids.join(","));
      } else {
        params.delete("suppliers");
      }
      params.set("period", nextPeriod);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, period, router, searchParams]
  );

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [ordersResult, suppliersResult] = await Promise.all([fetchOrders(user), fetchSuppliers()]);

    if (ordersResult.error) {
      showToast("Ошибка загрузки сравнения", {
        description: getFriendlyErrorMessage(
          ordersResult.error,
          "Не удалось загрузить данные для сравнения поставщиков."
        ),
        variant: "error",
      });
      setLoading(false);
      return;
    }

    setOrders((ordersResult.data as OrderWithItems[]) || []);
    setSuppliers(mapSuppliers((suppliersResult.data as SupplierSummary[]) || []));
    setLoading(false);
  }, [showToast, user]);

  useEffect(() => {
    if (user) {
      void loadData();
    } else {
      setOrders([]);
      setSuppliers([]);
      setLoading(false);
    }
  }, [loadData, user]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cutoffDate = useMemo(() => getAnalyticsCutoffDate(period), [period]);

  const filteredOrders = useMemo(() => {
    if (!cutoffDate) return orders;
    return orders.filter((order) => {
      const orderDate = normalizeDate(order.order_date);
      return !!orderDate && orderDate >= cutoffDate;
    });
  }, [cutoffDate, orders]);

  const compareRows = useMemo(
    () =>
      buildCompareRows({
        orders: filteredOrders,
        suppliers,
        selectedIds,
        today,
      }),
    [filteredOrders, selectedIds, suppliers, today]
  );

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
              title="Сравнение поставщиков недоступно"
              description="Для роли поставщика этот режим не нужен, поэтому оставляем его закрытым."
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
                      Supplier Compare
                    </div>
                    <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-white md:text-[32px]">
                      Сравнение поставщиков
                    </h1>
                    <p className="mt-1 max-w-3xl text-[14px] leading-6 text-slate-300">
                      Выбери от 2 до 5 поставщиков и сравни их по срокам, исполнению, отказам, скорости и стабильности.
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
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-16 text-center shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              <div className="mt-3 text-sm text-slate-500">Собираем сравнение поставщиков...</div>
            </div>
          ) : (
            <>
              <CardSection
                eyebrow="Выбор поставщиков"
                title="Сравнение 2–5 поставщиков"
                description={`Период: ${getAnalyticsPeriodLabel(period)}. Выбранные поставщики сохраняются в URL.`}
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    { id: "week", label: "Неделя" },
                    { id: "month", label: "Месяц" },
                    { id: "quarter", label: "Квартал" },
                    { id: "year", label: "Год" },
                    { id: "all", label: "За всё время" },
                  ].map((option) => {
                    const active = option.id === period;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateSuppliersQuery(selectedIds, option.id as AnalyticsPeriod)}
                        className={`rounded-[14px] border px-3.5 py-2 text-[13px] font-medium transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  {suppliers.map((supplier) => {
                    const id = String(supplier.id);
                    const active = selectedIds.includes(id);
                    return (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? selectedIds.filter((value) => value !== id)
                            : [...selectedIds, id].slice(0, 5);
                          updateSuppliersQuery(next);
                        }}
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {supplier.name}
                      </button>
                    );
                  })}
                </div>
              </CardSection>

              {compareRows.length < 2 ? (
                <EmptyStateCard
                  title="Выбери хотя бы двух поставщиков"
                  description="После выбора 2–5 поставщиков здесь появятся сравнительная диаграмма и таблица показателей."
                />
              ) : (
                <>
                  <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <CardSection
                      eyebrow="Сравнительная диаграмма"
                      title="Сравнение по пяти осям"
                      description="Сроки, исполнение, отказы, скорость и стабильность."
                    >
                      <RadarCompare rows={compareRows} />
                    </CardSection>

                    <CardSection
                      eyebrow="Сводка"
                      title="Ключевые показатели рядом"
                      description="Сразу видно, кто сильнее по общему рейтингу и кто проседает по срокам."
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        {compareRows.map((row) => (
                          <div key={row.supplierId} className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <Link href={`/analytics/suppliers/${row.supplierId}?period=${period}`} className="text-[16px] font-semibold text-slate-900 transition hover:text-slate-700">
                                  {row.supplierName}
                                </Link>
                                <div className="mt-1 text-[12px] text-slate-500">
                                  Класс {row.supplierClass} · рейтинг {Math.round(row.score)}
                                </div>
                              </div>
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                {formatPercent(row.onTimeDelivery)}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <InfoMini label="Строк" value={row.totalLines} />
                              <InfoMini label="Просрочено" value={row.overdueLinesCurrent} />
                              <InfoMini label="Отказано" value={row.canceledLines} />
                              <InfoMini label="Срок поставки" value={row.averageLeadTime || "—"} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardSection>
                  </div>

                  <CardSection
                    eyebrow="Таблица сравнения"
                    title="Подробное сравнение"
                    description="Лучшее значение в каждой колонке подсвечено, чтобы быстрее видеть лидера."
                  >
                    <CompareTable rows={compareRows} />
                  </CardSection>
                </>
              )}
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
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
          {title}
        </h2>
        <p className="mt-1 text-[14px] leading-6 text-slate-500">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: number | string }) {
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

function RadarCompare({ rows }: { rows: CompareRow[] }) {
  const metrics = [
    { label: "Сроки", getter: (row: CompareRow) => row.onTimeDelivery },
    { label: "Исполнение", getter: (row: CompareRow) => row.fillRate },
    { label: "Отказы", getter: (row: CompareRow) => Math.max(0, 100 - row.refusalRate) },
    { label: "Скорость", getter: (row: CompareRow) => Math.max(0, 100 - row.averageLeadTime * 6) },
    { label: "Стабильность", getter: (row: CompareRow) => row.stability },
  ];

  const center = 180;
  const radius = 120;
  const colors = ["#0F766E", "#14B8A6", "#64748B", "#DC2626", "#2563EB"];

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-center">
      <svg viewBox="0 0 360 360" className="mx-auto h-[320px] w-[320px]">
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <polygon
            key={ring}
            points={metrics
              .map((_, index) => {
                const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
                const x = center + Math.cos(angle) * radius * ring;
                const y = center + Math.sin(angle) * radius * ring;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="#E5E7EB"
          />
        ))}

        {metrics.map((metric, index) => {
          const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return (
            <g key={metric.label}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="#E5E7EB" />
              <text x={x} y={y - 8} textAnchor="middle" className="fill-slate-500 text-[12px]">
                {metric.label}
              </text>
            </g>
          );
        })}

        {rows.map((row, rowIndex) => {
          const points = metrics
            .map((metric, index) => {
              const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
              const value = Math.max(0, Math.min(metric.getter(row), 100));
              const x = center + Math.cos(angle) * radius * (value / 100);
              const y = center + Math.sin(angle) * radius * (value / 100);
              return `${x},${y}`;
            })
            .join(" ");
          return (
            <polygon
              key={row.supplierId}
              points={points}
              fill={colors[rowIndex % colors.length]}
              fillOpacity="0.14"
              stroke={colors[rowIndex % colors.length]}
              strokeWidth="2"
            />
          );
        })}
      </svg>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.supplierId} className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <Link href={`/analytics/suppliers/${row.supplierId}?period=month`} className="text-[15px] font-semibold text-slate-900 transition hover:text-slate-700">
                {row.supplierName}
              </Link>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-slate-600">
              <div>Сроки: {formatPercent(row.onTimeDelivery)}</div>
              <div>Исполнение: {formatPercent(row.fillRate)}</div>
              <div>Отказы: {formatPercent(100 - row.refusalRate)}</div>
              <div>Стабильность: {formatPercent(row.stability)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareTable({ rows }: { rows: CompareRow[] }) {
  const bestScore = getBestValue(rows, "score");
  const bestOrders = getBestValue(rows, "totalOrders");
  const bestLines = getBestValue(rows, "totalLines");
  const bestDelivered = getBestValue(rows, "deliveredLines");
  const bestOnTime = getBestValue(rows, "onTimeDelivery");
  const bestFill = getBestValue(rows, "fillRate");
  const bestRefusal = getBestValue(rows, "refusalRate", true);
  const bestLead = getBestValue(rows, "averageLeadTime", true);
  const bestDelay = getBestValue(rows, "averageDelay", true);

  const highlight = (active: boolean) =>
    active ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-700";

  return (
    <div className="rounded-[20px] border border-slate-200">
      <div className="hidden overflow-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50/95">
            <tr>
              {["Поставщик", "Рейтинг", "Класс", "Заказы", "Строки", "Исполнено", "Отказано", "Просрочено", "В срок, %", "Исполнение, %", "Отказы, %", "Срок поставки", "Задержка"].map((label) => (
                <th key={label} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr key={row.supplierId} className="bg-white">
                <td className="px-4 py-3.5">
                  <Link href={`/analytics/suppliers/${row.supplierId}`} className="font-semibold text-slate-900 transition hover:text-slate-700">
                    {row.supplierName}
                  </Link>
                </td>
                <td className={`px-4 py-3.5 text-sm ${highlight(row.score === bestScore)}`}>{Math.round(row.score)}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{row.supplierClass}</td>
                <td className={`px-4 py-3.5 text-sm ${highlight(row.totalOrders === bestOrders)}`}>{row.totalOrders}</td>
                <td className={`px-4 py-3.5 text-sm ${highlight(row.totalLines === bestLines)}`}>{row.totalLines}</td>
                <td className={`px-4 py-3.5 text-sm ${highlight(row.deliveredLines === bestDelivered)}`}>{row.deliveredLines}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{row.canceledLines}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{row.overdueLinesCurrent}</td>
                <td className={`px-4 py-3.5 text-sm ${highlight(row.onTimeDelivery === bestOnTime)}`}>{formatPercent(row.onTimeDelivery)}</td>
                <td className={`px-4 py-3.5 text-sm ${highlight(row.fillRate === bestFill)}`}>{formatPercent(row.fillRate)}</td>
                <td className={`px-4 py-3.5 text-sm ${highlight(row.refusalRate === bestRefusal)}`}>{formatPercent(row.refusalRate)}</td>
                <td className={`px-4 py-3.5 text-sm ${highlight(row.averageLeadTime === bestLead)}`}>{row.averageLeadTime || "—"}</td>
                <td className={`px-4 py-3.5 text-sm ${highlight(row.averageDelay === bestDelay)}`}>{row.averageDelay || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {rows.map((row) => (
          <div key={row.supplierId} className="rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="text-[15px] font-semibold text-slate-900">{row.supplierName}</div>
            <div className="mt-1 text-[12px] text-slate-500">
              Рейтинг {Math.round(row.score)} · Класс {row.supplierClass}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <InfoMini label="Поставка в срок" value={formatPercent(row.onTimeDelivery)} />
              <InfoMini label="Исполнение" value={formatPercent(row.fillRate)} />
              <InfoMini label="Отказы" value={formatPercent(row.refusalRate)} />
              <InfoMini label="Срок поставки" value={row.averageLeadTime || "—"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
