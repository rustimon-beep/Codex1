import type {
  ParsedComment,
  SortDirection,
  OrderItem,
  ItemForm,
} from "./types";

export function getTodayDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function createEmptyOrderForm(emptyItem: ItemForm) {
  return {
    clientOrder: "",
    orderDate: getTodayDate(),
    orderType: "Стандартный",
    comment: "",
    newComment: "",
    bulkPlannedDate: "",
    bulkStatus: "Новый",
    items: [{ ...emptyItem }],
  };
}

export function formatDateTimeForDb(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function formatDate(dateString: string | null) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatDateTimeForView(dateString: string | null) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function compareValues(
  a: string | number | null,
  b: string | number | null,
  direction: SortDirection
) {
  const aVal = a ?? "";
  const bVal = b ?? "";

  if (typeof aVal === "number" && typeof bVal === "number") {
    return direction === "asc" ? aVal - bVal : bVal - aVal;
  }

  const result = String(aVal).localeCompare(String(bVal), "ru", {
    numeric: true,
  });

  return direction === "asc" ? result : -result;
}

export function statusClasses(status: string) {
  if (status === "Поставлен") {
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  }
  if (status === "Отменен" || status === "Частично отменен") {
    return "bg-rose-100 text-rose-700 border border-rose-200";
  }
  if (status === "В пути") {
    return "bg-violet-100 text-violet-700 border border-violet-200";
  }
  if (status === "В работе") {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

export function orderTypeClasses(orderType: string) {
  if (orderType === "Срочный") {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }
  return "bg-sky-100 text-sky-700 border border-sky-200";
}

export function statusSelectClasses(status: string) {
  if (status === "Поставлен") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "Отменен") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "В пути") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (status === "В работе") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function getOrderProgress(items: OrderItem[]) {
  const total = items.length;
  const delivered = items.filter((item) => item.status === "Поставлен").length;
  const canceled = items.filter((item) => item.status === "Отменен").length;
  const active = total - delivered - canceled;

  return { total, delivered, canceled, active };
}

export function getOrderStatus(items: OrderItem[]) {
  if (items.length === 0) return "Новый";

  const statuses = items.map((item) => item.status || "Новый");
  const total = statuses.length;
  const deliveredCount = statuses.filter((s) => s === "Поставлен").length;
  const canceledCount = statuses.filter((s) => s === "Отменен").length;

  if (deliveredCount === total) return "Поставлен";
  if (canceledCount === total) return "Отменен";
  if (canceledCount > 0) return "Частично отменен";
  if (deliveredCount > 0) return "Частично поставлен";
  if (statuses.includes("В пути")) return "В пути";
  if (statuses.includes("В работе")) return "В работе";
  return "Новый";
}

export function getOrderPlannedDate(items: OrderItem[]) {
  const dates = items.map((item) => item.planned_date).filter(Boolean).sort();
  return dates[dates.length - 1] || null;
}

export function getOrderDeliveredDate(items: OrderItem[]) {
  const allDelivered =
    items.length > 0 && items.every((item) => item.status === "Поставлен");

  if (!allDelivered) return null;

  const dates = items.map((item) => item.delivered_date).filter(Boolean).sort();
  return dates[dates.length - 1] || null;
}

export function isItemOverdue(item: OrderItem) {
  return !!(
    item.planned_date &&
    item.status !== "Поставлен" &&
    item.status !== "Отменен" &&
    new Date(item.planned_date) < new Date(new Date().toDateString())
  );
}

export function isOrderOverdue(items: OrderItem[]) {
  return items.some((item) => isItemOverdue(item));
}

export function hasComment(comment: string | null) {
  return !!comment?.trim();
}

export function hasReplacementInOrder(items: OrderItem[]) {
  return items.some((item) => !!item.replacement_article?.trim());
}

export function buildCommentEntry(author: string, text: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const prettyDate = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;

  return `[${prettyDate}] ${author}:\n${text.trim()}`;
}

export function mergeComments(existing: string | null, author: string, newText: string) {
  const trimmed = newText.trim();
  if (!trimmed) return existing || "";
  const entry = buildCommentEntry(author, trimmed);
  return [existing?.trim(), entry].filter(Boolean).join("\n\n");
}

export function appendCommentEntries(existing: string | null, entries: string[]) {
  const cleanEntries = entries.map((x) => x.trim()).filter(Boolean);
  if (cleanEntries.length === 0) return existing || "";
  return [existing?.trim(), ...cleanEntries].filter(Boolean).join("\n\n");
}

export function parseComments(commentText: string | null): ParsedComment[] {
  if (!commentText?.trim()) return [];

  const blocks = commentText.split(/\n\s*\n/g).filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split("\n");
    const firstLine = lines[0] || "";
    const messageText = lines.slice(1).join("\n").trim();
    const match = firstLine.match(/^\[(.+?)\]\s+(.+?):$/);

    if (match) {
      return {
        datetime: match[1],
        author: match[2],
        text: messageText || "",
      };
    }

    return {
      datetime: "",
      author: "Система",
      text: block,
    };
  });
}

export function getCellValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

export function parseExcelItems(rows: Record<string, unknown>[]): ItemForm[] {
  const items = rows
    .map((row) => {
      const article = getCellValue(row, ["Артикул", "артикул", "Article", "article"]);
      const name = getCellValue(row, ["Наименование", "наименование", "Name", "name"]);
      const quantity = getCellValue(row, [
        "Количество",
        "количество",
        "Quantity",
        "quantity",
        "Кол-во",
        "qty",
        "Кол-во всего",
      ]);

      return {
        article,
        hasReplacement: false,
        replacementArticle: "",
        name,
        quantity,
        plannedDate: "",
        status: "Новый",
        deliveredDate: "",
        canceledDate: "",
      };
    })
    .filter((item) => item.article || item.name || item.quantity);

  return items;
}

export function normalizeDateForCompare(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}
