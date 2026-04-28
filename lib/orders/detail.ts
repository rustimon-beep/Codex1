import type { ItemForm, OrderFormState, OrderItem, OrderWithItems } from "./types";

export function mapOrderToFormState(order: OrderWithItems, emptyItem: ItemForm): OrderFormState {
  return {
    clientOrder: order.client_order || "",
    orderDate: order.order_date || "",
    orderType: order.order_type || "Стандартный",
    supplierId: order.supplier_id ? String(order.supplier_id) : "",
    comment: order.comment || "",
    newComment: "",
    bulkPlannedDate: "",
    bulkStatus: "Новый",
    items:
      order.order_items?.map((item) => ({
        id: item.id,
        article: item.article || "",
        hasReplacement: !!item.replacement_article,
        replacementArticle: item.replacement_article || "",
        name: item.name || "",
        quantity: item.quantity || "",
        plannedDate: item.planned_date || "",
        initialPlannedDate: item.initial_planned_date || item.planned_date || "",
        plannedDateChangeCount: item.planned_date_change_count || 0,
        plannedDateLastChangedAt: item.planned_date_last_changed_at || "",
        plannedDateLastChangedBy: item.planned_date_last_changed_by || "",
        status: item.status || "Новый",
        deliveredDate: item.delivered_date || "",
        canceledDate: item.canceled_date || "",
      })) || [{ ...emptyItem }],
  };
}

export function mapFormItemsToOrderItems(items: ItemForm[], orderId: number): OrderItem[] {
  return items.map((item, index) => ({
    id: item.id || -(index + 1),
    order_id: orderId || 0,
    article: item.article || null,
    replacement_article: item.hasReplacement ? item.replacementArticle || null : null,
    name: item.name || null,
    quantity: item.quantity || null,
    planned_date: item.plannedDate || null,
    initial_planned_date: item.initialPlannedDate || item.plannedDate || null,
    planned_date_change_count: item.plannedDateChangeCount || 0,
    planned_date_last_changed_at: item.plannedDateLastChangedAt || null,
    planned_date_last_changed_by: item.plannedDateLastChangedBy || null,
    status: item.status || "Новый",
    delivered_date: item.deliveredDate || null,
    canceled_date: item.canceledDate || null,
  }));
}
