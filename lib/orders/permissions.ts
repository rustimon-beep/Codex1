import { isItemOverdue, normalizeDateForCompare } from "./utils";
import type { ItemForm, OrderItem, UserProfile } from "./types";

export function canCreateOrder(user: UserProfile | null) {
  return user?.role === "admin" || user?.role === "buyer";
}

export function canEditOrderTextFields(user: UserProfile | null) {
  return user?.role === "admin" || user?.role === "buyer";
}

export function canEditItemMainFields(user: UserProfile | null) {
  return user?.role === "admin" || user?.role === "buyer";
}

export function canImportItems(user: UserProfile | null) {
  return user?.role === "admin" || user?.role === "buyer";
}

export function canEditItemStatusFields(user: UserProfile | null) {
  return user?.role === "admin" || user?.role === "supplier";
}

type PlannedDateSource = Pick<OrderItem, "planned_date" | "status"> | Pick<ItemForm, "plannedDate" | "status">;

function getPlannedDateValue(item?: PlannedDateSource | null) {
  if (!item) return null;
  if ("planned_date" in item) return normalizeDateForCompare(item.planned_date);
  return normalizeDateForCompare(item.plannedDate);
}

function getStatusValue(item?: PlannedDateSource | null) {
  if (!item) return "Новый";
  return item.status || "Новый";
}

export function canEditItemPlannedDate(user: UserProfile | null, item?: PlannedDateSource | null) {
  if (user?.role === "admin") return true;
  if (user?.role !== "supplier") return false;

  const plannedDate = getPlannedDateValue(item);
  if (!plannedDate) return false;

  return isItemOverdue({
    id: 0,
    order_id: 0,
    article: null,
    replacement_article: null,
    name: null,
    quantity: null,
    planned_date: plannedDate,
    status: getStatusValue(item),
    delivered_date: null,
    canceled_date: null,
  });
}

export function canComment(user: UserProfile | null) {
  return !!user && user.role !== "viewer";
}

export function canUseBulkActions(user: UserProfile | null) {
  return canUseBulkStatusActions(user) || canUseBulkPlannedDateActions(user);
}

export function canUseBulkStatusActions(user: UserProfile | null) {
  return user?.role === "admin" || user?.role === "supplier";
}

export function canUseBulkPlannedDateActions(user: UserProfile | null) {
  return user?.role === "admin";
}

export function canEditOrderDate(user: UserProfile | null) {
  return user?.role === "admin";
}
