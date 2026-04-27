import type { UserProfile } from "./types";

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

export function canEditItemPlannedDate(user: UserProfile | null) {
  return user?.role === "admin" || user?.role === "supplier";
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
