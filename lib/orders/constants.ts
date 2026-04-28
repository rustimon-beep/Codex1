import type { ItemForm } from "./types";

export const STATUS_OPTIONS = [
  "Новый",
  "В работе",
  "В пути",
  "Поставлен",
  "Отменен",
] as const;

export const ORDER_TYPE_OPTIONS = ["Стандартный", "Срочный"] as const;

export const EMPTY_ITEM: ItemForm = {
  article: "",
  hasReplacement: false,
  replacementArticle: "",
  name: "",
  quantity: "",
  plannedDate: "",
  deadlineBreachedAt: "",
  status: "Новый",
  deliveredDate: "",
  canceledDate: "",
};
