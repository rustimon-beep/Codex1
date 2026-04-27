import type { OrderWithItems, SupplierSummary } from "../orders/types";
import { getOrderStatus } from "../orders/utils";

export type SupplierAnalyticsRow = {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  activeOrders: number;
  deliveredOrders: number;
  canceledOrders: number;
  totalLines: number;
  activeLines: number;
  deliveredLines: number;
  canceledLines: number;
  overdueLinesCurrent: number;
  overdueLinesEver: number;
  overdueShare: number;
  deliveredShare: number;
};

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function getSupplierAnalyticsTone(row: SupplierAnalyticsRow) {
  if (row.overdueShare >= 40) {
    return "border-rose-200 bg-rose-50/70";
  }
  if (row.overdueShare >= 20) {
    return "border-amber-200 bg-amber-50/70";
  }
  return "border-emerald-200 bg-emerald-50/60";
}

export function buildSupplierAnalytics(params: {
  orders: OrderWithItems[];
  suppliers: SupplierSummary[];
  historicalOverdueBySupplier: Record<string, number>;
}) {
  const { orders, suppliers, historicalOverdueBySupplier } = params;
  const today = new Date().toISOString().slice(0, 10);

  const orderGroups = new Map<string, OrderWithItems[]>();

  for (const order of orders) {
    const key = order.supplier_id ? String(order.supplier_id) : "unassigned";
    const existing = orderGroups.get(key) || [];
    existing.push(order);
    orderGroups.set(key, existing);
  }

  const supplierNames = new Map<string, string>();
  suppliers.forEach((supplier) => supplierNames.set(String(supplier.id), supplier.name));
  supplierNames.set("unassigned", "Без поставщика");

  const rows: SupplierAnalyticsRow[] = Array.from(orderGroups.entries()).map(
    ([supplierId, supplierOrders]) => {
      const totalOrders = supplierOrders.length;
      const deliveredOrders = supplierOrders.filter(
        (order) => getOrderStatus(order.order_items || []) === "Поставлен"
      ).length;
      const canceledOrders = supplierOrders.filter(
        (order) => getOrderStatus(order.order_items || []) === "Отменен"
      ).length;
      const activeOrders = totalOrders - deliveredOrders - canceledOrders;
      const allItems = supplierOrders.flatMap((order) => order.order_items || []);
      const totalLines = allItems.length;
      const deliveredLines = allItems.filter(
        (item) => item.status === "Поставлен" || !!item.delivered_date
      ).length;
      const canceledLines = allItems.filter(
        (item) => item.status === "Отменен" || !!item.canceled_date
      ).length;
      const overdueLinesCurrent = allItems.filter((item) => {
        const plannedDate = (item.planned_date || "").slice(0, 10);
        const delivered = item.status === "Поставлен" || !!item.delivered_date;
        const canceled = item.status === "Отменен" || !!item.canceled_date;

        return !!plannedDate && plannedDate < today && !delivered && !canceled;
      }).length;
      const activeLines = totalLines - deliveredLines - canceledLines;
      const overdueLinesEver = historicalOverdueBySupplier[supplierId] || 0;

      return {
        supplierId,
        supplierName: supplierNames.get(supplierId) || `Поставщик #${supplierId}`,
        totalOrders,
        activeOrders,
        deliveredOrders,
        canceledOrders,
        totalLines,
        activeLines,
        deliveredLines,
        canceledLines,
        overdueLinesCurrent,
        overdueLinesEver,
        overdueShare: totalLines > 0 ? (overdueLinesEver / totalLines) * 100 : 0,
        deliveredShare: totalLines > 0 ? (deliveredLines / totalLines) * 100 : 0,
      };
    }
  );

  rows.sort((a, b) => {
    if (b.overdueShare !== a.overdueShare) return b.overdueShare - a.overdueShare;
    if (b.totalLines !== a.totalLines) return b.totalLines - a.totalLines;
    return a.supplierName.localeCompare(b.supplierName, "ru");
  });

  const overview = {
    suppliersCount: rows.length,
    totalOrders: rows.reduce((sum, row) => sum + row.totalOrders, 0),
    activeOrders: rows.reduce((sum, row) => sum + row.activeOrders, 0),
    canceledOrders: rows.reduce((sum, row) => sum + row.canceledOrders, 0),
    totalLines: rows.reduce((sum, row) => sum + row.totalLines, 0),
    activeLines: rows.reduce((sum, row) => sum + row.activeLines, 0),
    canceledLines: rows.reduce((sum, row) => sum + row.canceledLines, 0),
    overdueLinesEver: rows.reduce((sum, row) => sum + row.overdueLinesEver, 0),
  };

  const overdueShareTotal =
    overview.totalLines > 0 ? (overview.overdueLinesEver / overview.totalLines) * 100 : 0;

  return {
    rows,
    overview: {
      ...overview,
      overdueShareTotal,
    },
  };
}
