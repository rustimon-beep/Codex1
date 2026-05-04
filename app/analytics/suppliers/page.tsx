"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { LoginForm } from "../../../components/orders/LoginForm";
import { EmptyStateCard } from "../../../components/ui/EmptyStateCard";
import { MobileBottomNav } from "../../../components/ui/MobileBottomNav";
import { MobileLaunchReveal } from "../../../components/ui/MobileLaunchReveal";
import { ToastViewport } from "../../../components/ui/ToastViewport";
import { AppLogo } from "../../../components/ui/AppLogo";
import { useOrdersAuthActions } from "../../../lib/auth/useOrdersAuthActions";
import { useProfileAuth } from "../../../lib/auth/useProfileAuth";
import {
  calculateSupplierScore,
  classifySupplier,
  collectSupplierPeriodMetrics,
  compareSupplierPeriods,
  type SupplierClass,
} from "../../../lib/analytics/supplierKpi";
import {
  getAnalyticsCutoffDate,
  getAnalyticsPeriodLabel,
  getAnalyticsPreviousWindow,
  parseAnalyticsPeriod,
  type AnalyticsPeriod,
} from "../../../lib/analytics/periods";
import { fetchOrders } from "../../../lib/orders/api";
import type { OrderHeader, OrderItem, OrderWithItems, SupplierSummary } from "../../../lib/orders/types";
import { getFriendlyErrorMessage, normalizeToastOptions } from "../../../lib/ui/network";
import { useToast } from "../../../lib/ui/useToast";
import { fetchSuppliers, mapSuppliers } from "../../../lib/suppliers/api";

type SupplierHealth = "excellent" | "normal" | "attention" | "critical";
type SortField =
  | "rank"
  | "supplier"
  | "score"
  | "class"
  | "orders"
  | "lines"
  | "delivered"
  | "canceled"
  | "overdue"
  | "ontime"
  | "fill"
  | "refusal"
  | "lead"
  | "delay"
  | "trend"
  | "health";
type SortDirection = "asc" | "desc";

type SupplierRatingRow = {
  rank: number;
  supplierId: string;
  supplierName: string;
  supplierClass: SupplierClass;
  health: SupplierHealth;
  healthLabel: string;
  score: number;
  totalOrders: number;
  breachedOrdersEver: number;
  totalLines: number;
  breachedActiveLines: number;
  deliveredLines: number;
  canceledLines: number;
  overdueLinesEver: number;
  onTimeDelivery: number;
  fillRate: number;
  refusalRate: number;
  averageLeadTime: number;
  averageDelay: number;
  deliveredShare: number;
  trendDelta: number;
  trendDirection: "up" | "down" | "flat";
};

type LineRecord = {
  id: number;
  orderId: number;
  supplierId: string;
  supplierName: string;
  clientOrder: string;
  orderType: string;
  article: string;
  name: string;
  quantity: string;
  status: string;
  orderDate: string;
  plannedDate: string;
  deliveredDate: string;
  canceledDate: string;
  isDelivered: boolean;
  isCanceled: boolean;
  isOverdue: boolean;
  deliveredOnTime: boolean;
  leadTimeDays: number | null;
  delayDays: number | null;
};

type HistoricalOverdueEntry = {
  orderItemId: number;
  orderId: number;
  supplierId: number | null;
  firstOverdueAt: string;
};

const PERIOD_OPTIONS: Array<{ id: AnalyticsPeriod; label: string }> = [
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "quarter", label: "Квартал" },
  { id: "year", label: "Год" },
  { id: "all", label: "За всё время" },
];

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

function formatTrend(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value * 10) / 10}`;
}

function diffDays(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

function getSupplierKey(order: Pick<OrderHeader, "supplier_id">) {
  return order.supplier_id ? String(order.supplier_id) : "unassigned";
}

function getSupplierNameMap(suppliers: SupplierSummary[]) {
  const map = new Map<string, string>();
  suppliers.forEach((supplier) => map.set(String(supplier.id), supplier.name));
  map.set("unassigned", "Без поставщика");
  return map;
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

function getHealthFromScore(score: number): SupplierHealth {
  if (score >= 90) return "excellent";
  if (score >= 75) return "normal";
  if (score >= 60) return "attention";
  return "critical";
}

function getHealthLabel(health: SupplierHealth) {
  switch (health) {
    case "excellent":
      return "Отличный";
    case "normal":
      return "Нормальный";
    case "attention":
      return "Требует внимания";
    case "critical":
      return "Критичный";
  }
}

function getClassDescription(value: SupplierClass) {
  switch (value) {
    case "A":
      return "отличный";
    case "B":
      return "надежный";
    case "C":
      return "нестабильный";
    case "D":
      return "проблемный";
  }
}

function getClassTone(value: SupplierClass) {
  switch (value) {
    case "A":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "B":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "C":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "D":
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

function getHealthTone(value: SupplierHealth) {
  switch (value) {
    case "excellent":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "normal":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "attention":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "critical":
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

function getSupplierAnalyticsHref(supplierId: string, period: AnalyticsPeriod) {
  return `/analytics/suppliers/${supplierId}?period=${period}`;
}

function matchOrderPeriod(order: OrderWithItems, cutoffDate: string | null, previousEnd?: string | null) {
  const orderDate = normalizeDate(order.order_date);
  if (!orderDate) return false;
  if (previousEnd) {
    return orderDate >= cutoffDate! && orderDate <= previousEnd;
  }
  if (!cutoffDate) return true;
  return orderDate >= cutoffDate;
}

function matchOrderType(order: OrderWithItems, typeFilter: string) {
  if (typeFilter === "all") return true;
  const normalized = (order.order_type || "").toLowerCase();
  if (typeFilter === "urgent") return normalized.includes("сроч");
  if (typeFilter === "standard") return !normalized.includes("сроч");
  return true;
}

function projectOrderByLineFilters(
  order: OrderWithItems,
  params: {
    today: string;
    onlyOverdue: boolean;
    onlyCanceled: boolean;
    onlyActive: boolean;
    historicalOverdueItemIds: Set<number>;
  }
) {
  const { today, onlyActive, onlyCanceled, onlyOverdue, historicalOverdueItemIds } = params;
  const originalItems = order.order_items || [];

  const projectedItems = originalItems.filter((item) => {
    const overdue = isCurrentOverdue(item, today);
    const breachedEver =
      Boolean(item.deadline_breached_at) ||
      historicalOverdueItemIds.has(item.id) ||
      overdue;
    const canceled = isCanceled(item);
    const delivered = isDelivered(item);
    const active = !delivered && !canceled;

    if (onlyOverdue && !breachedEver) return false;
    if (onlyCanceled && !canceled) return false;
    if (onlyActive && !active) return false;
    return true;
  });

  if (!projectedItems.length) return null;
  return {
    ...order,
    order_items: projectedItems,
  };
}

function flattenLines(orders: OrderWithItems[], supplierNameMap: Map<string, string>, today: string): LineRecord[] {
  return orders.flatMap((order) => {
    const supplierId = getSupplierKey(order);
    const supplierName = supplierNameMap.get(supplierId) || `Поставщик #${supplierId}`;

    return (order.order_items || []).map((item) => {
      const orderDate = normalizeDate(order.order_date);
      const plannedDate = normalizeDate(item.planned_date);
      const deliveredDate = normalizeDate(item.delivered_date);
      const canceledDate = normalizeDate(item.canceled_date);
      const delivered = isDelivered(item);
      const canceled = isCanceled(item);
      const overdue = isCurrentOverdue(item, today);
      const leadTimeDays = orderDate && deliveredDate ? diffDays(orderDate, deliveredDate) : null;
      const delayDays =
        plannedDate && deliveredDate && deliveredDate > plannedDate
          ? diffDays(plannedDate, deliveredDate)
          : null;

      return {
        id: item.id,
        orderId: order.id,
        supplierId,
        supplierName,
        clientOrder: order.client_order || `Заказ #${order.id}`,
        orderType: order.order_type || "Стандартный",
        article: item.article || "—",
        name: item.name || "—",
        quantity: item.quantity || "—",
        status: item.status || "Новый",
        orderDate,
        plannedDate,
        deliveredDate,
        canceledDate,
        isDelivered: delivered,
        isCanceled: canceled,
        isOverdue: overdue,
        deliveredOnTime: delivered && !!plannedDate && !!deliveredDate && deliveredDate <= plannedDate,
        leadTimeDays,
        delayDays,
      };
    });
  });
}

function buildSupplierRatingRows(params: {
  currentOrders: OrderWithItems[];
  previousOrders: OrderWithItems[];
  suppliers: SupplierSummary[];
  today: string;
  historicalOverdueItemIds: Set<number>;
}) {
  const { currentOrders, previousOrders, suppliers, today, historicalOverdueItemIds } = params;
  const supplierNameMap = getSupplierNameMap(suppliers);
  const supplierIds = Array.from(new Set(currentOrders.map((order) => getSupplierKey(order))));

  const rows = supplierIds
    .map((supplierId) => {
      const supplierOrders = currentOrders.filter((order) => getSupplierKey(order) === supplierId);
      const previousSupplierOrders = previousOrders.filter(
        (order) => getSupplierKey(order) === supplierId
      );
      const metrics = collectSupplierPeriodMetrics(supplierOrders, today, historicalOverdueItemIds);
      if (!metrics.totalLines) return null;

      const previousMetrics = collectSupplierPeriodMetrics(
        previousSupplierOrders,
        today,
        historicalOverdueItemIds
      );
      const score = calculateSupplierScore({
        onTimeDelivery: metrics.onTimeDelivery,
        fillRate: metrics.fillRate,
        refusalRate: metrics.refusalRate,
        averageLeadTime: metrics.averageLeadTime,
        communicationScore: metrics.communicationScore,
      });
      const previousScore = calculateSupplierScore({
        onTimeDelivery: previousMetrics.onTimeDelivery,
        fillRate: previousMetrics.fillRate,
        refusalRate: previousMetrics.refusalRate,
        averageLeadTime: previousMetrics.averageLeadTime,
        communicationScore: previousMetrics.communicationScore,
      });
      const supplierClass = classifySupplier(score.total);
      const health = getHealthFromScore(score.total);
      const trend = compareSupplierPeriods(score.total, previousScore.total);

      return {
        rank: 0,
        supplierId,
        supplierName: supplierNameMap.get(supplierId) || `Поставщик #${supplierId}`,
        supplierClass,
        health,
        healthLabel: getHealthLabel(health),
        score: score.total,
        totalOrders: metrics.totalOrders,
        breachedOrdersEver: metrics.breachedOrdersEver,
        totalLines: metrics.totalLines,
        breachedActiveLines: metrics.breachedActiveLines,
        deliveredLines: metrics.deliveredLines,
        canceledLines: metrics.canceledLines,
        overdueLinesEver: metrics.overdueLinesEver,
        onTimeDelivery: metrics.onTimeDelivery,
        fillRate: metrics.fillRate,
        refusalRate: metrics.refusalRate,
        averageLeadTime: metrics.averageLeadTime,
        averageDelay: metrics.averageDelay,
        deliveredShare: metrics.totalLines > 0 ? (metrics.deliveredLines / metrics.totalLines) * 100 : 0,
        trendDelta: trend.delta,
        trendDirection: trend.direction,
      } satisfies SupplierRatingRow;
    })
    .filter((row): row is SupplierRatingRow => !!row)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.overdueLinesEver !== b.overdueLinesEver) return a.overdueLinesEver - b.overdueLinesEver;
      return a.supplierName.localeCompare(b.supplierName, "ru");
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  return rows;
}

function exportSupplierRating(rows: SupplierRatingRow[]) {
  const exportRows = rows.map((row) => ({
    Место: row.rank,
    Поставщик: row.supplierName,
    Рейтинг: row.score,
    Класс: row.supplierClass,
    Статус: row.healthLabel,
    Заказов: row.totalOrders,
    "Заказов с нарушенным 1-м сроком": row.breachedOrdersEver,
    Строк: row.totalLines,
    "Исполнено строк": row.deliveredLines,
    "Отказано строк": row.canceledLines,
    "Строк с нарушенным 1-м сроком": row.overdueLinesEver,
    "Поставка в срок %": Math.round(row.onTimeDelivery * 10) / 10,
    "Исполнение %": Math.round(row.fillRate * 10) / 10,
    "Отказы, %": Math.round(row.refusalRate * 10) / 10,
    "Средний срок поставки": row.averageLeadTime,
    "Средняя задержка, дн.": row.averageDelay,
    "Изменение к прошлому периоду": row.trendDelta,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Рейтинг поставщиков");
  XLSX.writeFile(workbook, "reyting-postavshchikov.xlsx");
}

function getSortValue(row: SupplierRatingRow, field: SortField) {
  switch (field) {
    case "rank":
      return row.rank;
    case "supplier":
      return row.supplierName;
    case "score":
      return row.score;
    case "class":
      return row.supplierClass;
    case "orders":
      return row.totalOrders;
    case "lines":
      return row.totalLines;
    case "delivered":
      return row.deliveredLines;
    case "canceled":
      return row.canceledLines;
    case "overdue":
      return row.overdueLinesEver;
    case "ontime":
      return row.onTimeDelivery;
    case "fill":
      return row.fillRate;
    case "refusal":
      return row.refusalRate;
    case "lead":
      return row.averageLeadTime;
    case "delay":
      return row.averageDelay;
    case "trend":
      return row.trendDelta;
    case "health":
      return row.healthLabel;
  }
}

export default function SupplierAnalyticsDashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const period = parseAnalyticsPeriod(searchParams.get("period"));
  const searchQuery = searchParams.get("q") || "";
  const supplierFilter = searchParams.get("supplier") || "all";
  const classFilter = searchParams.get("class") || "all";
  const healthFilter = searchParams.get("health") || "all";
  const typeFilter = searchParams.get("type") || "all";
  const onlyOverdue = searchParams.get("onlyOverdue") === "1";
  const onlyCanceled = searchParams.get("onlyCanceled") === "1";
  const onlyActive = searchParams.get("onlyActive") === "1";
  const sortField = (searchParams.get("sort") as SortField) || "score";
  const sortDirection = (searchParams.get("dir") as SortDirection) || "desc";

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [historicalOverdueEntries, setHistoricalOverdueEntries] = useState<HistoricalOverdueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

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

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === "all" || value === "0") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const loadAnalytics = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const [ordersResult, suppliersResult, overdueResult] = await Promise.all([
      fetchOrders(user),
      fetchSuppliers(),
      fetch("/api/suppliers/analytics", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) {
          throw new Error("Не удалось загрузить журнал нарушений срока.");
        }
        return response.json();
      }),
    ]);

    if (ordersResult.error) {
      showToast("Ошибка загрузки аналитики", {
        description: getFriendlyErrorMessage(
          ordersResult.error,
          "Не удалось загрузить данные для аналитики поставщиков."
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
  const currentCutoff = useMemo(() => getAnalyticsCutoffDate(period), [period]);
  const previousWindow = useMemo(() => getAnalyticsPreviousWindow(period), [period]);
  const supplierNameMap = useMemo(() => getSupplierNameMap(suppliers), [suppliers]);
  const historicalOverdueItemIds = useMemo(
    () => new Set(historicalOverdueEntries.map((entry) => entry.orderItemId)),
    [historicalOverdueEntries]
  );

  const currentOrders = useMemo(() => {
    return orders
      .filter((order) => matchOrderPeriod(order, currentCutoff))
      .filter((order) => matchOrderType(order, typeFilter))
      .map((order) =>
        projectOrderByLineFilters(order, {
          today,
          onlyOverdue,
          onlyCanceled,
          onlyActive,
          historicalOverdueItemIds,
        })
      )
      .filter(Boolean) as OrderWithItems[];
  }, [currentCutoff, historicalOverdueItemIds, onlyActive, onlyCanceled, onlyOverdue, orders, today, typeFilter]);

  const previousOrders = useMemo(() => {
    if (!previousWindow.previousStart || !previousWindow.previousEnd) return [];

    return orders
      .filter((order) => matchOrderPeriod(order, previousWindow.previousStart, previousWindow.previousEnd))
      .filter((order) => matchOrderType(order, typeFilter))
      .map((order) =>
        projectOrderByLineFilters(order, {
          today,
          onlyOverdue,
          onlyCanceled,
          onlyActive,
          historicalOverdueItemIds,
        })
      )
      .filter(Boolean) as OrderWithItems[];
  }, [historicalOverdueItemIds, onlyActive, onlyCanceled, onlyOverdue, orders, previousWindow.previousEnd, previousWindow.previousStart, today, typeFilter]);

  const allRows = useMemo(
    () =>
      buildSupplierRatingRows({
        currentOrders,
        previousOrders,
        suppliers,
        today,
        historicalOverdueItemIds,
      }),
    [currentOrders, historicalOverdueItemIds, previousOrders, suppliers, today]
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allRows.filter((row) => {
      if (supplierFilter !== "all" && row.supplierId !== supplierFilter) return false;
      if (classFilter !== "all" && row.supplierClass !== classFilter) return false;
      if (healthFilter !== "all" && row.health !== healthFilter) return false;
      if (query && !row.supplierName.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [allRows, classFilter, healthFilter, searchQuery, supplierFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aValue = getSortValue(a, sortField);
      const bValue = getSortValue(b, sortField);

      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue, "ru");
        return sortDirection === "asc" ? comparison : -comparison;
      }

      const comparison = Number(aValue) - Number(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredRows, sortDirection, sortField]);

  const visibleSupplierIds = useMemo(
    () => new Set(sortedRows.map((row) => row.supplierId)),
    [sortedRows]
  );

  const visibleOrders = useMemo(
    () => currentOrders.filter((order) => visibleSupplierIds.has(getSupplierKey(order))),
    [currentOrders, visibleSupplierIds]
  );

  const visibleLines = useMemo(
    () => flattenLines(visibleOrders, supplierNameMap, today),
    [supplierNameMap, today, visibleOrders]
  );

  const overallMetrics = useMemo(
    () => collectSupplierPeriodMetrics(visibleOrders, today, historicalOverdueItemIds),
    [historicalOverdueItemIds, today, visibleOrders]
  );

  const ratingSummary = useMemo(() => {
    const excellentCount = sortedRows.filter((row) => row.health === "excellent").length;
    const criticalCount = sortedRows.filter((row) => row.health === "critical").length;
    const riskRows = sortedRows.filter(
      (row) => row.health === "critical" || row.health === "attention"
    );

    return {
      excellentCount,
      criticalCount,
      riskRows,
    };
  }, [sortedRows]);

  const handleSort = (field: SortField) => {
    const nextDirection: SortDirection =
      sortField === field && sortDirection === "desc" ? "asc" : "desc";
    updateQuery({
      sort: field,
      dir: nextDirection,
    });
  };

  const handleLogout = () => {
    void logout();
  };

  const handleExport = () => {
    exportSupplierRating(sortedRows);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent">
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
        <div className="min-h-screen bg-transparent p-3 md:p-8">
          <div className="mx-auto max-w-5xl">
            <EmptyStateCard
              title="Сводная аналитика поставщиков недоступна"
              description="Для роли поставщика этот раздел не показываем."
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

      <div className="min-h-screen bg-transparent p-2 text-slate-900 antialiased md:p-8">
        <div className="bottom-nav-safe mx-auto max-w-7xl space-y-4 md:space-y-6 md:pb-0">
          <div className="premium-shell overflow-hidden rounded-[24px]">
            <div className="relative bg-[linear-gradient(180deg,#151A22_0%,#111827_100%)] px-4 py-4 text-white md:px-8 md:py-7">
              <div className="absolute inset-y-0 right-0 w-[34%] bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.12),transparent_58%)] pointer-events-none" />

              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4 md:gap-6">
                  <div className="shrink-0 pt-1">
                    <AppLogo compact showText={false} />
                  </div>
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">
                      Аналитика поставщиков
                    </div>
                    <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-white md:text-[32px]">
                      Аналитика поставщиков
                    </h1>
                    <p className="mt-1 max-w-3xl text-[14px] leading-6 text-slate-300">
                      Рейтинг, ключевые показатели, отказные линии, нарушения первого срока, зоны
                      внимания и переход к конкретным заказам.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:min-w-[340px] lg:items-end">
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
                      href="/"
                      className="rounded-[14px] bg-white px-4 py-2 text-center text-[12px] font-semibold text-slate-900 transition hover:bg-slate-100 md:px-4 md:py-2.5 md:text-[13px]"
                    >
                      К заказам
                    </Link>
                    <Link
                      href={`/analytics/suppliers/compare?period=${period}`}
                      className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-2 text-center text-[12px] font-semibold text-white transition hover:bg-white/10 md:px-4 md:py-2.5 md:text-[13px]"
                    >
                      Сравнение
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="premium-shell rounded-[24px] px-6 py-16 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              <div className="mt-3 text-sm text-slate-500">Собираем аналитику поставщиков...</div>
            </div>
          ) : !allRows.length ? (
            <EmptyStateCard
              title="Пока нет данных для аналитики поставщиков"
              description="Когда в системе будут заказы со строками и назначенными поставщиками, здесь появится рейтинг и ключевые показатели."
            />
          ) : (
            <>
              <div className="premium-shell rounded-[24px] p-4 md:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <SectionHeading
                    eyebrow="Глобальные фильтры"
                    title="Панель аналитики поставщиков"
                    description="Фильтры сохраняются в адресной строке и влияют на верхние показатели, рейтинг и детализацию ниже."
                  />

                  <div className="flex flex-wrap gap-2">
                    {PERIOD_OPTIONS.map((option) => {
                      const active = option.id === period;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => updateQuery({ period: option.id })}
                          className={`rounded-[14px] border px-3.5 py-2 text-[13px] font-medium transition ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                              : "border-white/80 bg-white/62 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] hover:border-white hover:bg-white/82"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <FilterField label="Поставщик">
                    <select
                      value={supplierFilter}
                      onChange={(event) => updateQuery({ supplier: event.target.value })}
                      className={filterInputClassName}
                    >
                      <option value="all">Все поставщики</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={String(supplier.id)}>
                          {supplier.name}
                        </option>
                      ))}
                      <option value="unassigned">Без поставщика</option>
                    </select>
                  </FilterField>

                  <FilterField label="Поиск по поставщику">
                    <input
                      value={searchQuery}
                      onChange={(event) => updateQuery({ q: event.target.value || null })}
                      placeholder="Начни вводить название"
                      className={filterInputClassName}
                    />
                  </FilterField>

                  <FilterField label="Класс">
                    <select
                      value={classFilter}
                      onChange={(event) => updateQuery({ class: event.target.value })}
                      className={filterInputClassName}
                    >
                      <option value="all">Все классы</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </FilterField>

                  <FilterField label="Статус поставщика">
                    <select
                      value={healthFilter}
                      onChange={(event) => updateQuery({ health: event.target.value })}
                      className={filterInputClassName}
                    >
                      <option value="all">Все статусы</option>
                      <option value="excellent">Отличный</option>
                      <option value="normal">Нормальный</option>
                      <option value="attention">Требует внимания</option>
                      <option value="critical">Критичный</option>
                    </select>
                  </FilterField>

                  <FilterField label="Тип заказа">
                    <select
                      value={typeFilter}
                      onChange={(event) => updateQuery({ type: event.target.value })}
                      className={filterInputClassName}
                    >
                      <option value="all">Все типы</option>
                      <option value="standard">Стандартный</option>
                      <option value="urgent">Срочный</option>
                    </select>
                  </FilterField>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ToggleChip
                    active={onlyOverdue}
                    label="Только с нарушением первого срока"
                      onClick={() => updateQuery({ onlyOverdue: onlyOverdue ? null : "1" })}
                  />
                  <ToggleChip
                    active={onlyCanceled}
                    label="Только отказы"
                      onClick={() => updateQuery({ onlyCanceled: onlyCanceled ? null : "1" })}
                  />
                  <ToggleChip
                    active={onlyActive}
                    label="Только активные"
                      onClick={() => updateQuery({ onlyActive: onlyActive ? null : "1" })}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      updateQuery({
                        period: "month",
                        supplier: null,
                        q: null,
                        class: null,
                        health: null,
                        type: null,
                        onlyOverdue: null,
                        onlyCanceled: null,
                        onlyActive: null,
                        sort: "score",
                        dir: "desc",
                      })
                    }
                    className="rounded-[14px] border border-white/80 bg-white/62 px-3.5 py-2 text-[13px] font-medium text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] transition hover:border-white hover:bg-white/82"
                  >
                    Сбросить фильтры
                  </button>

                  {user.role === "admin" ? (
                    <button
                      type="button"
                      onClick={handleExport}
                      className="premium-button rounded-[14px] px-3.5 py-2 text-[13px] font-medium text-white"
                    >
                      Экспорт в таблицу
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <KpiActionCard
                  title="Всего поставщиков"
                  value={sortedRows.length}
                  accent="bg-slate-500"
                  hint="Активный пул"
                />
                <KpiActionCard
                  title="Всего заказов"
                  value={visibleOrders.length}
                  accent="bg-sky-500"
                  hint="Заказы в периоде"
                />
                <KpiActionCard
                  title="Всего строк заказов"
                  value={visibleLines.length}
                  accent="bg-amber-500"
                  hint="Рабочий объём"
                />
                <KpiActionCard
                  title="Процент исполненных строк"
                  value={formatPercent(overallMetrics.fillRate)}
                  accent="bg-emerald-500"
                  hint="Уровень исполнения"
                />
                <KpiActionCard
                  title="Процент отказов"
                  value={formatPercent(overallMetrics.refusalRate)}
                  accent="bg-slate-400"
                  hint="Отказанные линии"
                />
                <KpiActionCard
                  title="Заказов с историческим нарушением первого срока"
                  value={overallMetrics.breachedOrdersEver}
                  accent="bg-rose-500"
                  hint="Историческое нарушение"
                />
                <KpiActionCard
                  title="Строк с историческим нарушением первого срока"
                  value={overallMetrics.overdueLinesEver}
                  accent="bg-rose-400"
                  hint="Нарушение не снимается"
                />
                <KpiActionCard
                  title="Средний срок поставки"
                  value={overallMetrics.averageLeadTime ? `${overallMetrics.averageLeadTime} дн.` : "—"}
                  accent="bg-teal-500"
                  hint="Среднее время поставки"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                <CardSection
                  eyebrow="Структура поставщиков"
                  title="Активное состояние линий"
                  description="Сколько линий ещё в работе без нарушения первого срока, сколько активных линий сейчас остаются с уже нарушенным первым сроком, сколько поставлены и сколько отказаны."
                >
                  <div className="space-y-4">
                    {sortedRows.map((row) => {
                      const healthyActive = Math.max(
                        row.totalLines - row.deliveredLines - row.canceledLines - row.breachedActiveLines,
                        0
                      );

                      return (
                        <div
                          key={`composition-${row.supplierId}`}
                          className="premium-card-hover rounded-[18px] border border-white/80 bg-white/64 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={getSupplierAnalyticsHref(row.supplierId, period)}
                                className="truncate text-[15px] font-semibold tracking-tight text-slate-900 transition hover:text-slate-700"
                              >
                                {row.supplierName}
                              </Link>
                              <div className="mt-0.5 text-[12px] text-slate-500">
                                {row.totalOrders} заказов · {row.totalLines} строк · рейтинг {Math.round(row.score)}
                              </div>
                            </div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getHealthTone(row.health)}`}>
                              {row.healthLabel}
                            </span>
                          </div>

                          <div className="mt-3">
                            <StackedBar
                              segments={[
                                { label: "В работе без нарушения", value: healthyActive, color: "bg-sky-500/85" },
                                { label: "Активное нарушение первого срока", value: row.breachedActiveLines, color: "bg-rose-500/90" },
                                { label: "Поставлено", value: row.deliveredLines, color: "bg-emerald-500/90" },
                                { label: "Отказано", value: row.canceledLines, color: "bg-slate-400/90" },
                              ]}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardSection>

                <CardSection
                  eyebrow="Риски и потери"
                  title="Историческое нарушение первого срока, отказы и динамика"
                  description="Здесь видно, у кого чаще в истории нарушался первый обещанный срок поставки, кто чаще уходит в отказ и кто заметно проседает к прошлому периоду."
                >
                  <div className="space-y-4">
                    {sortedRows.map((row) => (
                      <div
                        key={`risk-${row.supplierId}`}
                        className="premium-card-hover rounded-[18px] border border-white/80 bg-white/64 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={getSupplierAnalyticsHref(row.supplierId, period)}
                            className="truncate text-[15px] font-semibold tracking-tight text-slate-900 transition hover:text-slate-700"
                          >
                            {row.supplierName}
                          </Link>
                          <span className="text-[11px] text-slate-500">
                            {row.breachedOrdersEver} заказов и {row.overdueLinesEver} строк с историческим нарушением первого срока · {row.canceledLines} отказ.
                          </span>
                        </div>

                        <div className="mt-3 space-y-3">
                          <MetricBar label="Доля строк с историческим нарушением первого срока" value={row.totalLines ? (row.overdueLinesEver / row.totalLines) * 100 : 0} color="bg-rose-500" />
                          <MetricBar label="Отказы" value={row.refusalRate} color="bg-slate-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardSection>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <HighlightPanel
                  eyebrow="Лучшие"
                  title="Топ поставщиков периода"
                  description="На кого можно опираться по дисциплине первого срока, уровню исполнения и общей надёжности поставок."
                  tone="emerald"
                  rows={sortedRows
                    .slice()
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3)
                    .map((row) => ({
                      key: `best-${row.supplierId}`,
                      href: getSupplierAnalyticsHref(row.supplierId, period),
                      title: row.supplierName,
                      meta: `Рейтинг ${Math.round(row.score)} · ${row.totalLines} строк · ${row.deliveredLines} исполнено`,
                      badge: `${row.supplierClass} / ${row.healthLabel}`,
                      subbadge: `В срок ${formatPercent(row.onTimeDelivery)}`,
                    }))}
                />

                <HighlightPanel
                  eyebrow="Зоны внимания"
                  title="Поставщики с риском"
                  description="Самые слабые по нарушению первого срока, отказам и общему рейтингу."
                  tone="rose"
                  rows={ratingSummary.riskRows.slice(0, 3).map((row) => ({
                    key: `risk-${row.supplierId}`,
                    href: getSupplierAnalyticsHref(row.supplierId, period),
                    title: row.supplierName,
                    meta: `Строк с историческим нарушением первого срока: ${row.overdueLinesEver} · Отказано: ${row.canceledLines} · Изменение ${formatTrend(
                      row.trendDelta
                    )}`,
                    badge: `${row.supplierClass} / ${row.healthLabel}`,
                    subbadge: `Рейтинг ${Math.round(row.score)}`,
                  }))}
                />
              </div>

              <CardSection
                eyebrow="Рейтинг поставщиков"
                title="Рейтинг поставщиков"
                description="Таблица поддерживает сортировку, фильтры, поиск и переход в карточку поставщика."
              >
                <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                  <span>Период: {getAnalyticsPeriodLabel(period)}</span>
                  <span>•</span>
                  <span>Поставщиков: {sortedRows.length}</span>
                  <span>•</span>
                  <span>Критичных: {ratingSummary.criticalCount}</span>
                  <span>•</span>
                  <span>Отличных: {ratingSummary.excellentCount}</span>
                  <span>•</span>
                  <span>Заказов с историческим нарушением первого срока: {overallMetrics.breachedOrdersEver}</span>
                </div>

                <div className="hidden max-h-[680px] overflow-auto rounded-[22px] border border-white/80 bg-white/54 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] md:block">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl">
                      <tr>
                        <SortableHeader label="#" field="rank" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Поставщик" field="supplier" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Рейтинг" field="score" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Класс" field="class" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Заказы" field="orders" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Строки" field="lines" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Исполнено" field="delivered" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Отказано" field="canceled" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Строк с историческим нарушением первого срока" field="overdue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="В срок, %" field="ontime" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Исполнение, %" field="fill" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Отказы, %" field="refusal" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Срок поставки" field="lead" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Задержка" field="delay" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Изменение" field="trend" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Статус" field="health" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedRows.map((row) => (
                        <tr key={row.supplierId} className="bg-white/55 transition hover:bg-white/85">
                          <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">{row.rank}</td>
                          <td className="px-4 py-3.5">
                            <Link
                              href={getSupplierAnalyticsHref(row.supplierId, period)}
                              className="font-semibold text-slate-900 transition hover:text-slate-700"
                            >
                              {row.supplierName}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">{Math.round(row.score)}</td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getClassTone(row.supplierClass)}`}>
                              {row.supplierClass}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.totalOrders}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.totalLines}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.deliveredLines}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.canceledLines}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.overdueLinesEver}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{formatPercent(row.onTimeDelivery)}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{formatPercent(row.fillRate)}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{formatPercent(row.refusalRate)}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.averageLeadTime || "—"}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{row.averageDelay || "—"}</td>
                          <td className="px-4 py-3.5 text-sm">
                            <span className={`font-semibold ${row.trendDirection === "up" ? "text-emerald-600" : row.trendDirection === "down" ? "text-rose-600" : "text-slate-500"}`}>
                              {formatTrend(row.trendDelta)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getHealthTone(row.health)}`}>
                              {row.healthLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 md:hidden">
                  {sortedRows.map((row) => (
                    <div key={row.supplierId} className="premium-card-hover rounded-[20px] border border-white/80 bg-white/68 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={getSupplierAnalyticsHref(row.supplierId, period)}
                            className="text-[16px] font-semibold text-slate-900 transition hover:text-slate-700"
                          >
                            {row.rank}. {row.supplierName}
                          </Link>
                          <div className="mt-1 text-[12px] text-slate-500">
                            Рейтинг {Math.round(row.score)} · {row.totalOrders} заказов · {row.totalLines} строк
                          </div>
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getHealthTone(row.health)}`}>
                          {row.healthLabel}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <InfoMini label="Класс" value={row.supplierClass} />
                        <InfoMini label="Строк с историческим нарушением первого срока" value={row.overdueLinesEver} />
                        <InfoMini label="Заказов с историческим нарушением первого срока" value={row.breachedOrdersEver} />
                        <InfoMini label="Отказано" value={row.canceledLines} />
                        <InfoMini label="Изменение" value={formatTrend(row.trendDelta)} />
                        <InfoMini label="Исполнение" value={formatPercent(row.fillRate)} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardSection>

            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-[88px] right-4 z-[85] inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/72 px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-[0_18px_44px_rgba(15,23,42,0.14)] backdrop-blur-2xl transition hover:bg-white/88 md:bottom-6 md:right-6 md:px-3.5 md:py-2.5 md:text-[13px]"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
          i
        </span>
        Как считается аналитика
      </button>

      {helpOpen ? (
        <div className="fixed inset-0 z-[95] bg-slate-950/45 backdrop-blur-[2px]">
          <div className="flex min-h-screen items-end justify-center p-0 md:items-center md:p-4">
            <div className="premium-shell w-full rounded-t-[24px] md:max-h-[88vh] md:max-w-3xl md:rounded-[28px]">
              <div className="max-h-[88vh] overflow-y-auto px-4 py-4 md:px-6 md:py-6">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Справка
                    </div>
                    <h3 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[26px]">
                      Как считаются рейтинг и показатели
                    </h3>
                    <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-500 md:text-sm">
                      Здесь собрана простая логика расчёта, чтобы любой пользователь понимал,
                      откуда берутся проценты, рейтинг поставщика и его класс.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHelpOpen(false)}
                    className="rounded-full border border-white/80 bg-white/62 px-3 py-1.5 text-sm font-medium text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] transition hover:bg-white/82"
                  >
                    Закрыть
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[20px] border border-white/80 bg-white/62 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Общий рейтинг
                    </div>
                    <div className="mt-2 text-[16px] font-semibold text-slate-900">
                      Рейтинг поставщика
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-slate-600">
                      Рейтинг считается по шкале от 0 до 100. Чем выше доля поставок в срок,
                      чем меньше отказов и чем реже нарушается первый обещанный срок поставки, тем выше итоговый балл.
                    </p>
                    <div className="mt-3 rounded-[16px] border border-white/80 bg-white/70 px-3 py-3 text-[12px] leading-6 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
                      Основа рейтинга:
                      <br />
                      <span className="font-medium text-slate-800">35%</span> поставка в срок
                      <br />
                      <span className="font-medium text-slate-800">25%</span> исполнение строк
                      <br />
                      <span className="font-medium text-slate-800">20%</span> низкая доля отказов
                      <br />
                      <span className="font-medium text-slate-800">10%</span> средний срок поставки
                      <br />
                      <span className="font-medium text-slate-800">10%</span> дисциплина работы
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-white/80 bg-white/62 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Класс поставщика
                    </div>
                    <div className="mt-2 text-[16px] font-semibold text-slate-900">
                      Как читается класс A / B / C / D
                    </div>
                    <div className="mt-3 space-y-2 text-[13px] leading-6 text-slate-600">
                      <div><span className="font-semibold text-slate-900">A:</span> 90–100 — отличный поставщик</div>
                      <div><span className="font-semibold text-slate-900">B:</span> 75–89 — надёжный поставщик</div>
                      <div><span className="font-semibold text-slate-900">C:</span> 60–74 — нестабильный поставщик</div>
                      <div><span className="font-semibold text-slate-900">D:</span> ниже 60 — проблемный поставщик</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[22px] border border-white/80 bg-white/62 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] md:p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Пояснение показателей
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <HelpMetricCard title="Всего поставщиков" description="Количество поставщиков, которые попали в текущую выборку по фильтрам." />
                    <HelpMetricCard title="Всего заказов" description="Количество заказов в выбранном периоде после применения фильтров." />
                    <HelpMetricCard title="Всего строк заказов" description="Количество строк внутри заказов, которые участвуют в расчёте." />
                    <HelpMetricCard title="Процент исполненных строк" description="Доля строк со статусом «Поставлен» от общего числа строк." />
                    <HelpMetricCard title="Процент отказов" description="Доля строк со статусом отмены или отказа от общего числа строк." />
                    <HelpMetricCard title="Заказов с историческим нарушением первого срока" description="Сколько заказов содержат хотя бы одну строку, где первый обещанный срок поставки уже был нарушен." />
                    <HelpMetricCard title="Строк с историческим нарушением первого срока" description="Сколько строк уже нарушили первый обещанный срок поставки. Этот факт больше не снимается переносом новой даты." />
                    <HelpMetricCard title="Средний срок поставки" description="Среднее число дней между датой заказа и фактической датой поставки." />
                    <HelpMetricCard title="Поставка в срок" description="Доля строк, которые были поставлены не позже первого обещанного срока." />
                    <HelpMetricCard title="Исполнение" description="Сколько строк удалось закрыть поставкой от общего объёма строк." />
                    <HelpMetricCard title="Средняя задержка" description="Среднее число дней задержки по тем строкам, где поставка пришла позже первой обещанной даты." />
                    <HelpMetricCard title="Изменение к прошлому периоду" description="Показывает, вырос или снизился рейтинг по сравнению с предыдущим таким же периодом." />
                    <HelpMetricCard title="Зоны внимания" description="Поставщики, у которых чаще нарушается первый обещанный срок поставки, больше отказов или заметно хуже общий рейтинг." />
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50/70 px-4 py-3 text-[12px] leading-6 text-amber-900 md:text-[13px]">
                  Важно: в этой аналитике мы смотрим только на факт нарушения первого обещанного срока поставки.
                  Если первый срок уже был сорван, строка и заказ навсегда попадают в метрику
                  нарушения первого срока поставки, даже если позже поставщик указал новый срок и продолжил работу.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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

const filterInputClassName =
  "premium-input h-11 w-full rounded-[14px] px-3.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </div>
      {children}
    </label>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-white/80 bg-white/62 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] hover:border-white hover:bg-white/82"
      }`}
    >
      {label}
    </button>
  );
}

function HelpMetricCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[16px] border border-white/80 bg-white/66 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-[13px] leading-6 text-slate-600">{description}</div>
    </div>
  );
}

function KpiActionCard({
  title,
  value,
  accent,
  hint,
}: {
  title: string;
  value: number | string;
  accent: string;
  hint: string;
}) {
  return (
    <div className="premium-card-hover premium-shell rounded-[22px] px-4 py-3.5 text-left md:px-5 md:py-4">
      <div className="flex min-h-[50px] items-start justify-between gap-3">
        <div className="max-w-[82%] text-[11px] font-semibold uppercase tracking-[0.08em] leading-5 text-slate-500 md:text-[12px]">
          {title}
        </div>
        <div className={`mt-1 h-2 w-2 rounded-full opacity-75 ${accent}`} />
      </div>
      <div className="mt-2 text-[30px] font-semibold tracking-tight text-slate-900 md:text-[34px]">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-slate-400 md:text-[12px]">{hint}</div>
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
    <div className="premium-shell rounded-[24px] px-4 py-4 md:px-5 md:py-5">
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
    <div className="rounded-[16px] border border-white/80 bg-white/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
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

function HighlightPanel({
  eyebrow,
  title,
  description,
  tone,
  rows,
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone: "emerald" | "rose";
  rows: Array<{
    key: string;
    href?: string;
    title: string;
    meta: string;
    badge: string;
    subbadge: string;
  }>;
}) {
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/50"
      : "border-rose-200 bg-rose-50/50";
  const badgeClasses =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-rose-100 text-rose-800";

  return (
    <div className={`rounded-[24px] border px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ${toneClasses}`}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <Link
            key={row.key}
            href={row.href || "#"}
            className="block rounded-[18px] border border-white/80 bg-white/90 px-4 py-3 transition hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <div className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                    {row.title}
                  </div>
                </div>
                <div className="mt-1 text-[12px] leading-5 text-slate-500">{row.meta}</div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${badgeClasses}`}>
                  {row.badge}
                </span>
                <span className="text-[11px] text-slate-500">{row.subbadge}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const active = field === sortField;
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 transition hover:text-slate-700"
      >
        <span>{label}</span>
        <span className={`${active ? "text-slate-800" : "text-slate-300"}`}>
          {active && sortDirection === "asc" ? "↑" : "↓"}
        </span>
      </button>
    </th>
  );
}
