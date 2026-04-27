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
    status: item.status || "Новый",
    delivered_date: item.deliveredDate || null,
    canceled_date: item.canceledDate || null,
  }));
}
