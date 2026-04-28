import { isItemCurrentlyOverdue, normalizeDateForCompare } from "./utils";
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

type PlannedDateSource =
  | Pick<OrderItem, "planned_date" | "status" | "deadline_breached_at" | "delivered_date" | "canceled_date">
  | Pick<ItemForm, "plannedDate" | "status" | "deadlineBreachedAt" | "deliveredDate" | "canceledDate">;

function getPlannedDateValue(item?: PlannedDateSource | null) {
  if (!item) return null;
  if ("planned_date" in item) return normalizeDateForCompare(item.planned_date);
  return normalizeDateForCompare(item.plannedDate);
}

function getStatusValue(item?: PlannedDateSource | null) {
  if (!item) return "Новый";
  return item.status || "Новый";
}

function getDeadlineBreachedValue(item?: PlannedDateSource | null) {
  if (!item) return "";
  if ("deadline_breached_at" in item) return item.deadline_breached_at || "";
  if ("deadlineBreachedAt" in item) return item.deadlineBreachedAt || "";
  return "";
}

function getDeliveredValue(item?: PlannedDateSource | null) {
  if (!item) return null;
  if ("delivered_date" in item) return item.delivered_date || null;
  if ("deliveredDate" in item) return item.deliveredDate || null;
  return null;
}

function getCanceledValue(item?: PlannedDateSource | null) {
  if (!item) return null;
  if ("canceled_date" in item) return item.canceled_date || null;
  if ("canceledDate" in item) return item.canceledDate || null;
  return null;
}

export function canEditItemPlannedDate(user: UserProfile | null, item?: PlannedDateSource | null) {
  if (user?.role === "admin") return true;
  if (user?.role !== "supplier") return false;

  const plannedDate = getPlannedDateValue(item);
  if (!plannedDate && !getDeadlineBreachedValue(item)) return false;

  if (getDeadlineBreachedValue(item)) return true;

  return isItemCurrentlyOverdue({
    id: 0,
    order_id: 0,
    article: null,
    replacement_article: null,
    name: null,
    quantity: null,
    planned_date: plannedDate,
    deadline_breached_at: getDeadlineBreachedValue(item) || null,
    status: getStatusValue(item),
    delivered_date: getDeliveredValue(item),
    canceled_date: getCanceledValue(item),
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
  return user?.role === "admin" || user?.role === "supplier";
}

export function canEditOrderDate(user: UserProfile | null) {
  return user?.role === "admin";
}
