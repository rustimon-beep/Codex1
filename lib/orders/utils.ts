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
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "Отменен" || status === "Частично отменен") {
    if (status === "Частично отменен") {
      return "border border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "В пути") {
    return "border border-violet-200 bg-violet-50 text-violet-700";
  }
  if (status === "Частично поставлен") {
    return "border border-teal-200 bg-teal-50 text-teal-700";
  }
  if (status === "В работе") {
    return "border border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border border-slate-200 bg-slate-50 text-slate-700";
}

export function orderTypeClasses(orderType: string) {
  if (orderType === "Срочный") {
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border border-slate-200 bg-slate-50 text-slate-700";
}

export function statusSelectClasses(status: string) {
  if (status === "Поставлен") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "Отменен") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (status === "Частично отменен") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }
  if (status === "В пути") {
    return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800";
  }
  if (status === "Частично поставлен") {
    return "border-teal-200 bg-teal-50 text-teal-800";
  }
  if (status === "В работе") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  return "border-stone-200 bg-stone-50 text-stone-700";
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
        importSource: "excel" as const,
        importIssues: getImportedItemIssues({ article, name, quantity } as ItemForm),
      };
    })
    .filter((item) => item.article || item.name || item.quantity);

  return items;
}

export function parseClipboardItems(rawText: string): ItemForm[] {
  const lines = rawText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  const skipPatterns = [
    /артикул/i,
    /наименование/i,
    /кол-?во/i,
    /quantity/i,
    /article/i,
    /name/i,
  ];

  return lines
    .map((line) => {
      if (skipPatterns.some((pattern) => pattern.test(line))) {
        return null;
      }

      const normalized = line.replace(/\s+/g, " ").trim();

      let parts = normalized
        .split(/\t|;|\|/g)
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length < 3) {
        parts = normalized
          .split(/\s{2,}/g)
          .map((part) => part.trim())
          .filter(Boolean);
      }

      let article = "";
      let name = "";
      let quantity = "";

      if (parts.length >= 3) {
        article = parts[0] || "";
        quantity = parts[parts.length - 1] || "";
        name = parts.slice(1, -1).join(" ").trim();
      } else {
        const quantityMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*$/);
        quantity = quantityMatch?.[1] || "";

        const withoutQuantity = quantity
          ? normalized.slice(0, normalized.length - quantityMatch![0].length).trim()
          : normalized;

        const articleMatch = withoutQuantity.match(/^[A-Za-zА-Яа-я0-9._/-]+/);
        article = articleMatch?.[0] || "";
        name = article
          ? withoutQuantity.slice(article.length).trim()
          : withoutQuantity.trim();
      }

      const item: ItemForm = {
        article,
        hasReplacement: false,
        replacementArticle: "",
        name,
        quantity,
        plannedDate: "",
        status: "Новый",
        deliveredDate: "",
        canceledDate: "",
        importSource: "clipboard",
        importIssues: getImportedItemIssues({ article, name, quantity } as ItemForm),
      };

      return item.article || item.name || item.quantity ? item : null;
    })
    .filter(Boolean) as ItemForm[];
}

export function getImportedItemIssues(item: Pick<ItemForm, "article" | "name" | "quantity">) {
  const issues: string[] = [];

  if (!item.article.trim()) {
    issues.push("Нет артикула");
  }

  if (!item.name.trim()) {
    issues.push("Нет наименования");
  }

  if (!item.quantity.trim()) {
    issues.push("Нет количества");
  } else if (!/^\d+(?:[.,]\d+)?$/.test(item.quantity.trim())) {
    issues.push("Проверь количество");
  }

  return issues;
}

export function normalizeDateForCompare(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}
