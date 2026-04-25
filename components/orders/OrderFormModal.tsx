import type { Dispatch, SetStateAction } from "react";
import type { ItemForm, OrderFormState } from "../../lib/orders/types";
import { ORDER_TYPE_OPTIONS, STATUS_OPTIONS } from "../../lib/orders/constants";
import { formatDate, getTodayDate } from "../../lib/orders/utils";

type OrderFormModalProps = {
  open: boolean;
  saving: boolean;
  photoParsing: boolean;
  importReview: {
    source: "photo" | "excel" | "clipboard";
    importedCount: number;
    reviewCount: number;
  } | null;
  editingOrderId: number | null;
  userRole: "admin" | "supplier" | "viewer" | "buyer";
  form: OrderFormState;
  parsedComments: {
    datetime: string;
    author: string;
    text: string;
  }[];
  canEditOrderTextFields: boolean;
  canEditItemMainFields: boolean;
  canEditItemStatusFields: boolean;
  canComment: boolean;
  canUseBulkActions: boolean;
  canEditOrderDate: boolean;
  setOpen: (value: boolean) => void;
  setForm: Dispatch<SetStateAction<OrderFormState>>;
  applyBulkPlannedDate: () => void;
  applyBulkStatus: () => void;
  addItemRow: () => void;
  duplicateItemRow: (index: number) => void;
  clearItemRow: (index: number) => void;
  keepOnlyProblemItems: () => void;
  updateItemField: (
    index: number,
    field: keyof ItemForm,
    value: string | boolean
  ) => void;
  removeItemRow: (index: number) => void;
  saveForm: () => Promise<void>;
};

function formatDateInputValue(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function parseDateInputValue(value: string) {
  const normalized = value.trim().replace(/\//g, ".").replace(/-/g, ".");
  const match = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (!match) return value;

  const [, dayRaw, monthRaw, year] = match;
  const day = dayRaw.padStart(2, "0");
  const month = monthRaw.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function DateField({
  label,
  value,
  disabled,
  placeholder = "ДД.ММ.ГГГГ",
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-slate-700 md:text-sm">
        {label}
      </label>
      <input
        value={formatDateInputValue(value)}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(parseDateInputValue(e.target.value))}
        className="premium-input w-full rounded-[18px] px-3 py-2.5 text-[12px] text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-500 md:rounded-2xl md:py-3 md:text-sm"
      />
    </div>
  );
}

export function OrderFormModal({
  open,
  saving,
  photoParsing,
  importReview,
  editingOrderId,
  userRole,
  form,
  parsedComments,
  canEditOrderTextFields,
  canEditItemMainFields,
  canEditItemStatusFields,
  canComment,
  canUseBulkActions,
  canEditOrderDate,
  setOpen,
  setForm,
  applyBulkPlannedDate,
  applyBulkStatus,
  addItemRow,
  duplicateItemRow,
  clearItemRow,
  keepOnlyProblemItems,
  updateItemField,
  removeItemRow,
  saveForm,
}: OrderFormModalProps) {
  if (!open) return null;

  const isEditing = !!editingOrderId;
  const canEditOrderType = !isEditing && (userRole === "admin" || userRole === "buyer");
  const canManageItemsInCreate =
    !isEditing && (userRole === "admin" || userRole === "buyer");
  const filledItems = form.items.filter((item) =>
    [
      item.article,
      item.name,
      item.quantity,
      item.replacementArticle,
      item.plannedDate,
      item.deliveredDate,
      item.canceledDate,
    ].some((value) => value?.trim()) || item.hasReplacement
  );
  const missingClientOrder = !form.clientOrder.trim();
  const missingItems = filledItems.length === 0;
  const missingReplacement = filledItems.some(
    (item) => item.hasReplacement && !item.replacementArticle.trim()
  );
  const missingDeliveredDate = filledItems.some(
    (item) => item.status === "Поставлен" && !item.deliveredDate
  );
  const missingCanceledDate = filledItems.some(
    (item) => item.status === "Отменен" && !item.canceledDate
  );
  const blockingIssues = [
    missingClientOrder ? "Укажи номер клиентского заказа" : null,
    missingItems ? "Добавь хотя бы одну заполненную позицию" : null,
    missingReplacement ? "Заполни актуальный артикул для всех замен" : null,
    missingDeliveredDate ? "Для статуса «Поставлен» нужна дата поставки" : null,
    missingCanceledDate ? "Для статуса «Отменен» нужна дата отмены" : null,
  ].filter(Boolean) as string[];
  const saveDisabled = saving || photoParsing || blockingIssues.length > 0;
  const importedItems = form.items.filter((item) => !!item.importSource);
  const problematicImportedItems = importedItems.filter(
    (item) => (item.importIssues || []).length > 0
  );
  const readyImportedItems = importedItems.length - problematicImportedItems.length;

  const getFieldIssueState = (item: ItemForm, field: "article" | "name" | "quantity") => {
    const issues = item.importIssues || [];

    if (
      (field === "article" && issues.includes("Нет артикула")) ||
      (field === "name" && issues.includes("Нет наименования")) ||
      (field === "quantity" &&
        (issues.includes("Нет количества") || issues.includes("Проверь количество")))
    ) {
      return "border-amber-300 bg-amber-50/70";
    }

    if (item.importSource) {
      return "border-emerald-200 bg-emerald-50/40";
    }

    return "border-slate-200 bg-white";
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]">
      <div className="flex min-h-screen items-end justify-center p-0 md:items-center md:p-4">
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:my-8 md:h-auto md:max-h-[92vh] md:max-w-6xl md:rounded-[30px]">
          {saving || photoParsing ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white px-7 py-6 shadow-xl">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
                <div className="text-sm font-medium text-slate-700">
                  {photoParsing ? "Распознаём фото..." : "Сохраняем заказ..."}
                </div>
              </div>
            </div>
          ) : null}

          <div className="hero-premium shrink-0 border-b border-white/10 px-3.5 py-3.5 text-white md:px-6 md:py-5">
            <div className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="glass-chip inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200 md:px-3 md:text-[11px]">
                  {editingOrderId ? "Редактирование" : "Создание"}
                </div>
                <h2 className="premium-title mt-2.5 pr-2 text-[17px] font-semibold tracking-tight text-white md:mt-3 md:text-xl">
                  {editingOrderId ? "Редактировать заказ" : "Новый заказ"}
                </h2>
                <p className="mt-1 text-[12px] text-slate-300 md:text-sm">
                  Управление реквизитами заказа, комментариями и позициями.
                </p>
              </div>

              <button
                onClick={() => !saving && setOpen(false)}
                disabled={saving}
                className="glass-chip shrink-0 rounded-[18px] px-3 py-1.5 text-[12px] font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 md:rounded-2xl md:px-3 md:py-2 md:text-sm"
              >
                Закрыть
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 md:px-6 md:py-5">
            <div className="space-y-3.5 md:space-y-6">
              <section className="premium-shell rounded-[20px] p-2.5 md:rounded-[26px] md:p-5">
                <div className="mb-2.5 md:mb-4">
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500 md:text-sm">
                    Основная информация
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-slate-700 md:text-sm">
                      Номер клиентского заказа
                    </label>
                    <input
                      value={form.clientOrder}
                      disabled={!canEditOrderTextFields || saving}
                      onChange={(e) => setForm({ ...form, clientOrder: e.target.value })}
                      className="premium-input w-full rounded-[18px] px-3 py-2.5 text-[12px] text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-500 md:rounded-2xl md:py-3 md:text-sm"
                    />
                  </div>

                  {canEditOrderDate ? (
                    <DateField
                      label="Дата заказа"
                      value={form.orderDate}
                      disabled={!canEditOrderDate || saving}
                      onChange={(value) => setForm({ ...form, orderDate: value })}
                    />
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-slate-700 md:text-sm">
                        Дата заказа
                      </label>
                      <div className="w-full rounded-[18px] border border-slate-200 bg-slate-100 px-3 py-2.5 text-[12px] text-slate-500 md:rounded-2xl md:py-3 md:text-sm">
                        {formatDate(form.orderDate || getTodayDate())}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-slate-700 md:text-sm">
                      Тип заказа
                    </label>
                    <select
                      value={form.orderType}
                      disabled={!canEditOrderType || saving}
                      onChange={(e) => setForm({ ...form, orderType: e.target.value })}
                      className="premium-input w-full rounded-[18px] px-3 py-2.5 text-[12px] text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-500 md:rounded-2xl md:py-3 md:text-sm"
                    >
                      {ORDER_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    {isEditing ? (
                      <div className="w-full rounded-[18px] border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-500 md:rounded-2xl md:py-3 md:text-sm">
                        Тип заказа после создания не редактируется
                      </div>
                    ) : userRole === "buyer" ? (
                      <div className="w-full rounded-[18px] border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-500 md:rounded-2xl md:py-3 md:text-sm">
                        Дата заказа устанавливается автоматически
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              {canUseBulkActions ? (
                <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-3 md:rounded-[26px] md:p-5">
                  <div className="mb-3 md:mb-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Массовые действия
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_auto] md:items-end">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Плановая дата для всех позиций
                          </label>
                          <input
                            value={formatDateInputValue(form.bulkPlannedDate)}
                            disabled={saving || photoParsing}
                            placeholder="ДД.ММ.ГГГГ"
                            onChange={(e) =>
                              setForm({
                                ...form,
                                bulkPlannedDate: parseDateInputValue(e.target.value),
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </div>

                        <div>
                          <button
                            onClick={applyBulkPlannedDate}
                            disabled={saving || photoParsing}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                          >
                            Применить ко всем позициям
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_auto] md:items-end">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Статус для всех позиций
                          </label>
                          <select
                            value={form.bulkStatus}
                            disabled={saving || photoParsing}
                            onChange={(e) =>
                              setForm({ ...form, bulkStatus: e.target.value })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <button
                            onClick={applyBulkStatus}
                            disabled={saving || photoParsing}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                          >
                            Применить статус ко всем
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-3 md:rounded-[26px] md:p-5">
                <div className="mb-3 flex flex-col gap-3 md:mb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Позиции заказа
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Управление артикулами, статусами и заменами.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canManageItemsInCreate ? (
                      <button
                        onClick={addItemRow}
                        disabled={saving || photoParsing}
                        className="rounded-2xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Добавить позицию
                      </button>
                    ) : null}
                  </div>
                </div>

                {!isEditing ? (
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500">
                    Если ты выбрал создание по фото или Excel, проверь распознанные позиции и поправь их перед сохранением.
                  </div>
                ) : null}

                {importReview ? (
                  <div className="mb-4 rounded-[20px] border border-amber-200 bg-amber-50/90 px-3 py-3 text-[12px] text-amber-950 md:px-4 md:text-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">
                          {importReview.source === "photo"
                            ? "Фото распознано"
                            : importReview.source === "excel"
                            ? "Excel импортирован"
                            : "Буфер обмена обработан"}
                        </div>
                        <div className="mt-1 leading-5">
                          Загружено позиций: {importReview.importedCount}.{" "}
                          {importReview.reviewCount > 0
                            ? `Проверь строки с подсветкой: ${importReview.reviewCount}.`
                            : "Все строки выглядят заполненными."}
                        </div>
                      </div>

                      {importReview.reviewCount > 0 ? (
                        <button
                          type="button"
                          onClick={keepOnlyProblemItems}
                          disabled={saving || photoParsing}
                          className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-900 transition hover:bg-amber-100/70 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Оставить только проблемные
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Всего
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {importedItems.length}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                          Готово
                        </div>
                        <div className="mt-1 text-lg font-semibold text-emerald-900">
                          {readyImportedItems}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-100/70 px-3 py-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800">
                          Проверить
                        </div>
                        <div className="mt-1 text-lg font-semibold text-amber-950">
                          {problematicImportedItems.length}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                          Источник
                        </div>
                        <div className="mt-1 text-[13px] font-semibold text-stone-900">
                          {importReview.source === "photo"
                            ? "Фото"
                            : importReview.source === "excel"
                            ? "Excel"
                            : "Буфер"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div
                      key={item.id || `new-${index}`}
                      className={`rounded-2xl border bg-white p-3 md:p-4 ${
                        item.importIssues?.length
                          ? "border-amber-200 bg-amber-50/30"
                          : "border-slate-200"
                      }`}
                    >
                      {item.importSource ? (
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                              {item.importSource === "photo"
                                ? "Из фото"
                                : item.importSource === "excel"
                                ? "Из Excel"
                                : "Из буфера"}
                            </div>
                            {item.importIssues?.length ? (
                              <div className="rounded-full border border-amber-200 bg-amber-100/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-900">
                                Нужна проверка
                              </div>
                            ) : (
                              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                                Выглядит нормально
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateItemField(index, "hasReplacement", !item.hasReplacement)}
                              disabled={!canEditItemStatusFields || saving || photoParsing}
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                item.hasReplacement
                                  ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              Замена
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateItemRow(index)}
                              disabled={saving || photoParsing}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Дублировать
                            </button>
                            <button
                              type="button"
                              onClick={() => clearItemRow(index)}
                              disabled={saving || photoParsing}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Очистить
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {item.importIssues?.length ? (
                        <div className="mb-3 rounded-2xl border border-amber-200 bg-white/80 px-3 py-2 text-[12px] text-amber-950">
                          Проверь: {item.importIssues.join(", ")}.
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.5fr_0.5fr_0.95fr_1.1fr]">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Артикул
                          </label>
                          <input
                            value={item.article}
                            disabled={!canEditItemMainFields || saving || photoParsing}
                            onChange={(e) => updateItemField(index, "article", e.target.value)}
                            className={`w-full rounded-2xl border px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500 ${getFieldIssueState(
                              item,
                              "article"
                            )}`}
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Наименование
                          </label>
                          <input
                            value={item.name}
                            disabled={!canEditItemMainFields || saving || photoParsing}
                            onChange={(e) => updateItemField(index, "name", e.target.value)}
                            className={`w-full rounded-2xl border px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500 ${getFieldIssueState(
                              item,
                              "name"
                            )}`}
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Кол-во
                          </label>
                          <input
                            value={item.quantity}
                            disabled={!canEditItemMainFields || saving || photoParsing}
                            onChange={(e) => updateItemField(index, "quantity", e.target.value)}
                            className={`w-full rounded-2xl border px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500 ${getFieldIssueState(
                              item,
                              "quantity"
                            )}`}
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Плановая
                          </label>
                          <input
                            value={formatDateInputValue(item.plannedDate)}
                            disabled={!canEditItemStatusFields || saving || photoParsing}
                            placeholder="ДД.ММ.ГГГГ"
                            onChange={(e) =>
                              updateItemField(
                                index,
                                "plannedDate",
                                parseDateInputValue(e.target.value)
                              )
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Статус
                          </label>
                          <select
                            value={item.status}
                            disabled={!canEditItemStatusFields || saving || photoParsing}
                            onChange={(e) => updateItemField(index, "status", e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Актуальный артикул
                          </label>
                          <input
                            value={item.replacementArticle}
                            disabled={!canEditItemStatusFields || saving || photoParsing}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              updateItemField(index, "replacementArticle", nextValue);
                              updateItemField(
                                index,
                                "hasReplacement",
                                nextValue.trim().length > 0
                              );
                            }}
                            placeholder="Укажи актуальный артикул, если есть замена"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </div>

                        <div className="flex items-end">
                          {canManageItemsInCreate ? (
                            <button
                              onClick={() => removeItemRow(index)}
                              disabled={saving || photoParsing}
                              className="w-full rounded-2xl border border-rose-200 px-3 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                            >
                              Удалить
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-3 md:rounded-[26px] md:p-5">
                <div className="mb-3 md:mb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Комментарии
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Добавь пояснение после того, как заполнишь сам заказ и позиции.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      История комментариев
                    </label>
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 md:max-h-52">
                      {parsedComments.length === 0 ? (
                        <div className="text-sm text-slate-500">Комментариев пока нет</div>
                      ) : (
                        parsedComments.map((entry, index) => (
                          <div
                            key={`${entry.datetime}-${entry.author}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-semibold text-slate-800">
                                {entry.author}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {entry.datetime}
                              </div>
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {entry.text}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Новый комментарий
                    </label>
                    <textarea
                      value={form.newComment}
                      disabled={!canComment || saving || photoParsing}
                      onChange={(e) => setForm({ ...form, newComment: e.target.value })}
                      className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6 md:py-4">
            {blockingIssues.length > 0 ? (
              <div className="mb-3 rounded-[18px] border border-amber-200 bg-amber-50/90 px-3.5 py-3 text-[12px] text-amber-900 md:rounded-2xl md:px-4 md:text-sm">
                <div className="font-medium">Перед сохранением проверь:</div>
                <div className="mt-1.5 space-y-1">
                  {blockingIssues.map((issue) => (
                    <div key={issue}>• {issue}</div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center">
              <div className="text-[11px] text-slate-500 md:text-sm">
                Позиции: {filledItems.length} из {form.items.length}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => !saving && setOpen(false)}
                disabled={saving || photoParsing}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Отмена
              </button>
              <button
                onClick={saveForm}
                disabled={saveDisabled}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
