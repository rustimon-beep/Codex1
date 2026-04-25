import type { ItemForm, OrderItem, OrderWithItems, OrderFormState } from "./types";
import { appendCommentEntries, buildCommentEntry, formatDate, getTodayDate } from "./utils";

type ItemLabelSource = {
  article?: string | null;
  name?: string | null;
};

export function getItemLabel(item: ItemLabelSource) {
  return item.article || item.name || "без названия";
}

export function hasOnlyEmptyItemRow(items: ItemForm[]) {
  return (
    items.length === 1 &&
    !items[0].article &&
    !items[0].name &&
    !items[0].quantity &&
    !items[0].plannedDate &&
    !items[0].deliveredDate &&
    !items[0].canceledDate &&
    !items[0].replacementArticle
  );
}

export function prepareImportedItems(
  importedItems: ItemForm[],
  form: OrderFormState,
  canUseBulkActions: boolean
) {
  return importedItems.map((item) => {
    const status = canUseBulkActions ? form.bulkStatus || item.status : item.status;

    return {
      ...item,
      plannedDate: canUseBulkActions
        ? form.bulkPlannedDate || item.plannedDate
        : item.plannedDate,
      status,
      deliveredDate: status === "Поставлен" ? getTodayDate() : "",
      canceledDate: status === "Отменен" ? getTodayDate() : "",
    };
  });
}

export function getValidItems(items: ItemForm[]) {
  return items.filter(
    (item) =>
      item.article.trim() ||
      item.name.trim() ||
      item.quantity.trim() ||
      item.plannedDate.trim() ||
      item.deliveredDate.trim() ||
      item.canceledDate.trim() ||
      item.replacementArticle.trim()
  );
}

export function buildPlannedDateChangeComments(params: {
  validItems: ItemForm[];
  existingOrder: OrderWithItems | null;
  isEditing: boolean;
  authorName: string;
  normalizeDateForCompare: (value?: string | null) => string;
}) {
  const { validItems, existingOrder, isEditing, authorName, normalizeDateForCompare } =
    params;

  const existingItemsMap = new Map<number, OrderItem>(
    (existingOrder?.order_items || []).map((item) => [item.id, item])
  );

  const autoCommentEntries: string[] = [];

  for (const item of validItems) {
    if (!isEditing || !item.id) continue;

    const oldItem = existingItemsMap.get(item.id);
    if (!oldItem) continue;

    const oldPlannedRaw = oldItem.planned_date ?? "";
    const newPlannedRaw = item.plannedDate ?? "";

    const oldPlanned = normalizeDateForCompare(oldPlannedRaw);
    const newPlanned = normalizeDateForCompare(newPlannedRaw);

    if (oldPlanned === newPlanned) continue;
    if (!oldPlanned && newPlanned) continue;

    autoCommentEntries.push(
      buildCommentEntry(
        authorName,
        `Позиция ${getItemLabel(item)}: изменена плановая дата поставки. Было: ${formatDate(
          oldPlannedRaw || null
        )}. Стало: ${formatDate(newPlannedRaw || null)}`
      )
    );
  }

  return autoCommentEntries;
}

export function appendCancellationComment(params: {
  comment: string | null;
  authorName: string;
  item: ItemLabelSource;
  reason: string;
}) {
  const { comment, authorName, item, reason } = params;

  return appendCommentEntries(comment, [
    buildCommentEntry(
      authorName,
      `Позиция ${getItemLabel(item)}: статус изменен на "Отменен". Причина: ${reason.trim()}`
    ),
  ]);
}
