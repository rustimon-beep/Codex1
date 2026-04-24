import type {
  OrderWithItems,
  SortDirection,
  SortField,
} from "./types";
import {
  compareValues,
  getOrderProgress,
  getOrderStatus,
  isOrderOverdue,
} from "./utils";

function hasMissingPlannedDate(order: OrderWithItems) {
  const items = order.order_items || [];
  return items.some(
    (item) =>
      item.status !== "Поставлен" &&
      item.status !== "Отменен" &&
      !item.planned_date
  );
}

function isFullyClosed(order: OrderWithItems) {
  const status = getOrderStatus(order.order_items || []);
  return status === "Поставлен" || status === "Отменен";
}

function matchesStatusFilter(order: OrderWithItems, statusFilter: string) {
  if (statusFilter === "all") return true;
  if (statusFilter === "Просрочено") return isOrderOverdue(order.order_items || []);
  if (statusFilter === "Без плановой даты") return hasMissingPlannedDate(order);
  return getOrderStatus(order.order_items || []) === statusFilter;
}

type FilterOrdersParams = {
  orders: OrderWithItems[];
  search: string;
  statusFilter: string;
  orderTypeFilter: string;
  sortField: SortField;
  sortDirection: SortDirection;
};

export function getFilteredAndSortedOrders({
  orders,
  search,
  statusFilter,
  orderTypeFilter,
  sortField,
  sortDirection,
}: FilterOrdersParams) {
  const normalizedSearch = search.toLowerCase();

  const filtered = orders.filter((order) => {
    const items = order.order_items || [];
    const itemsText = items
      .map(
        (item) =>
          `${item.article || ""} ${item.replacement_article || ""} ${item.name || ""} ${item.status || ""}`
      )
      .join(" ")
      .toLowerCase();

    const orderStatus = getOrderStatus(items);
    const text =
      `${order.client_order || ""} ${order.order_type || ""} ${itemsText}`.toLowerCase();

    const matchesSearch = text.includes(normalizedSearch);
    const matchesStatus = matchesStatusFilter(order, statusFilter);
    const matchesType =
      orderTypeFilter === "all"
        ? true
        : (order.order_type || "Стандартный") === orderTypeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return [...filtered].sort((a, b) => {
    const aItems = a.order_items || [];
    const bItems = b.order_items || [];
    const aStatus = getOrderStatus(aItems);
    const bStatus = getOrderStatus(bItems);
    const aProgress = getOrderProgress(aItems).delivered;
    const bProgress = getOrderProgress(bItems).delivered;

    switch (sortField) {
      case "id":
        return compareValues(a.id, b.id, sortDirection);
      case "client_order":
        return compareValues(a.client_order, b.client_order, sortDirection);
      case "order_date":
        return compareValues(a.order_date, b.order_date, sortDirection);
      case "order_type":
        return compareValues(a.order_type, b.order_type, sortDirection);
      case "status":
        return compareValues(aStatus, bStatus, sortDirection);
      case "updated_at":
        return compareValues(a.updated_at, b.updated_at, sortDirection);
      case "progress":
        return compareValues(aProgress, bProgress, sortDirection);
      default:
        return 0;
    }
  });
}

export function getOrdersStats(orders: OrderWithItems[]) {
  return {
    total: orders.length,
    inProgress: orders.filter((order) =>
      ["Новый", "В работе", "В пути", "Частично поставлен", "Частично отменен"].includes(
        getOrderStatus(order.order_items || [])
      )
    ).length,
    delivered: orders.filter(
      (order) => getOrderStatus(order.order_items || []) === "Поставлен"
    ).length,
    overdue: orders.filter((order) => isOrderOverdue(order.order_items || [])).length,
  };
}

export function getOrdersAttention(orders: OrderWithItems[]) {
  const overdue = orders.filter((order) => isOrderOverdue(order.order_items || []));
  const urgent = orders.filter(
    (order) => (order.order_type || "Стандартный") === "Срочный" && !isFullyClosed(order)
  );
  const withoutPlannedDate = orders.filter((order) => hasMissingPlannedDate(order));
  const stale = orders.filter((order) => {
    if (isFullyClosed(order) || !order.updated_at) return false;
    const diffMs = Date.now() - new Date(order.updated_at).getTime();
    return diffMs > 1000 * 60 * 60 * 24 * 3;
  });

  const cards = [
    {
      key: "overdue",
      title: "Просрочено",
      description: "Нужно проверить сроки и статусы.",
      count: overdue.length,
      statusFilter: "Просрочено",
      orderTypeFilter: "all",
      sortField: "updated_at" as SortField,
      sortDirection: "desc" as SortDirection,
    },
    {
      key: "urgent",
      title: "Срочные",
      description: "Приоритетные заказы на сегодня.",
      count: urgent.length,
      statusFilter: "all",
      orderTypeFilter: "Срочный",
      sortField: "updated_at" as SortField,
      sortDirection: "desc" as SortDirection,
    },
    {
      key: "missing-planned",
      title: "Без плановой даты",
      description: "Есть позиции без срока поставки.",
      count: withoutPlannedDate.length,
      statusFilter: "Без плановой даты",
      orderTypeFilter: "all",
      sortField: "updated_at" as SortField,
      sortDirection: "desc" as SortDirection,
    },
    {
      key: "stale",
      title: "Давно не обновлялись",
      description: "Больше 3 дней без движения.",
      count: stale.length,
      statusFilter: "all",
      orderTypeFilter: "all",
      sortField: "updated_at" as SortField,
      sortDirection: "asc" as SortDirection,
    },
  ];

  const topAttentionOrders = orders
    .map((order) => {
      const reasons: string[] = [];
      if (isOrderOverdue(order.order_items || [])) reasons.push("Просрочен");
      if ((order.order_type || "Стандартный") === "Срочный" && !isFullyClosed(order)) {
        reasons.push("Срочный");
      }
      if (hasMissingPlannedDate(order)) reasons.push("Нет плановой даты");
      if (!isFullyClosed(order) && order.updated_at) {
        const diffMs = Date.now() - new Date(order.updated_at).getTime();
        if (diffMs > 1000 * 60 * 60 * 24 * 3) reasons.push("Нет обновлений 3+ дня");
      }

      return {
        order,
        reasons,
        status: getOrderStatus(order.order_items || []),
      };
    })
    .filter((entry) => entry.reasons.length > 0)
    .sort((a, b) => {
      const byReasonCount = b.reasons.length - a.reasons.length;
      if (byReasonCount !== 0) return byReasonCount;
      return compareValues(a.order.updated_at, b.order.updated_at, "desc");
    })
    .slice(0, 6);

  return {
    cards,
    topAttentionOrders,
  };
}
