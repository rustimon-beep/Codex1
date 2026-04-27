import type { OrderWithItems, SupplierSummary } from "../orders/types";
import { getOrderStatus } from "../orders/utils";

export type SupplierAnalyticsRow = {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  activeOrders: number;
  deliveredOrders: number;
  canceledOrders: number;
  overdueOrdersCurrent: number;
  overdueOrdersEver: number;
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
      const overdueOrdersCurrent = supplierOrders.filter((order) =>
        (order.order_items || []).some((item) => {
          const plannedDate = (item.planned_date || "").slice(0, 10);
          const today = new Date().toISOString().slice(0, 10);
          const delivered = item.status === "Поставлен" || !!item.delivered_date;
          const canceled = item.status === "Отменен" || !!item.canceled_date;

          return !!plannedDate && plannedDate < today && !delivered && !canceled;
        })
      ).length;
      const activeOrders = totalOrders - deliveredOrders - canceledOrders;
      const overdueOrdersEver = historicalOverdueBySupplier[supplierId] || 0;

      return {
        supplierId,
        supplierName: supplierNames.get(supplierId) || `Поставщик #${supplierId}`,
        totalOrders,
        activeOrders,
        deliveredOrders,
        canceledOrders,
        overdueOrdersCurrent,
        overdueOrdersEver,
        overdueShare: totalOrders > 0 ? (overdueOrdersEver / totalOrders) * 100 : 0,
        deliveredShare: totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0,
      };
    }
  );

  rows.sort((a, b) => {
    if (b.overdueShare !== a.overdueShare) return b.overdueShare - a.overdueShare;
    if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders;
    return a.supplierName.localeCompare(b.supplierName, "ru");
  });

  const overview = {
    suppliersCount: rows.length,
    totalOrders: rows.reduce((sum, row) => sum + row.totalOrders, 0),
    activeOrders: rows.reduce((sum, row) => sum + row.activeOrders, 0),
    overdueOrdersEver: rows.reduce((sum, row) => sum + row.overdueOrdersEver, 0),
  };

  const overdueShareTotal =
    overview.totalOrders > 0 ? (overview.overdueOrdersEver / overview.totalOrders) * 100 : 0;

  return {
    rows,
    overview: {
      ...overview,
      overdueShareTotal,
    },
  };
}
