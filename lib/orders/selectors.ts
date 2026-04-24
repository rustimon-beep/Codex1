import type {
  OrderWithItems,
  SortDirection,
  SortField,
} from "./types";
import { compareValues, getOrderProgress, getOrderStatus, isOrderOverdue } from "./utils";

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
    const matchesStatus = statusFilter === "all" ? true : orderStatus === statusFilter;
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
