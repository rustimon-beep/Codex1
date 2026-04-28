"use client";

import { useCallback } from "react";
import { notifyOrderChanged } from "../notifications/api";
import {
  buildOrderItemPayload,
  createPlannedDateHistoryEntry,
  deleteItemsByOrderId,
  deleteOrderById,
  registerFirstOverdueItem,
  updateOrderHeader,
  updateOrderItem,
} from "./api";
import { canEditItemPlannedDate } from "./permissions";
import {
  appendCancellationComment,
  buildPlannedDateChangeComments,
  getItemLabel,
  getValidItems,
} from "./operations";
import type { ItemForm, OrderFormState, OrderWithItems, UserProfile } from "./types";
import { appendCommentEntries, formatDateTimeForDb, getTodayDate, hasComment, isItemOverdue, mergeComments, normalizeDateForCompare } from "./utils";

type ToastFn = (
  title: string,
  options?: { description?: string; variant?: "success" | "error" | "info" }
) => void;

type PromptFn = (params: {
  title: string;
  description?: string;
  confirmText?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
}) => Promise<string | null>;

type ConfirmFn = (params: {
  title: string;
  description?: string;
  confirmText?: string;
  variant?: "default" | "danger";
}) => Promise<boolean>;

export function useOrderDetailActions(params: {
  user: UserProfile | null;
  order: OrderWithItems | null;
  form: OrderFormState;
  saving: boolean;
  setSaving: (value: boolean) => void;
  setRemoving: (value: boolean) => void;
  setForm: React.Dispatch<React.SetStateAction<OrderFormState>>;
  loadOrder: () => Promise<void>;
  requestPrompt: PromptFn;
  requestConfirmation: ConfirmFn;
  showToast: ToastFn;
  routerPush: (href: string) => void;
}) {
  const {
    user,
    order,
    form,
    saving,
    setSaving,
    setRemoving,
    setForm,
    loadOrder,
    requestPrompt,
    requestConfirmation,
    showToast,
    routerPush,
  } = params;

  const updateItemField = useCallback(
    (index: number, field: keyof ItemForm, value: string | boolean) => {
      void (async () => {
        const currentItem = form.items[index];
        const originalItem = currentItem?.id
          ? (order?.order_items || []).find((existing) => existing.id === currentItem.id) || null
          : null;
        const hasUnsavedSupplierPlannedDateChange =
          user?.role === "supplier" &&
          !!originalItem &&
          normalizeDateForCompare(currentItem?.plannedDate) !==
            normalizeDateForCompare(originalItem.planned_date);

        if (user?.role === "buyer" && (field === "plannedDate" || field === "status")) {
          return;
        }

        if (
          field === "plannedDate" &&
          !canEditItemPlannedDate(user, originalItem || currentItem) &&
          !hasUnsavedSupplierPlannedDateChange
        ) {
          showToast("Срок нельзя перенести", {
            description:
              "Поставщик может менять плановую дату только после того, как позиция уже ушла в просрочку.",
            variant: "error",
          });
          return;
        }

        if (field === "status" && value === "Отменен") {
          const currentItem = form.items[index];
          const currentStatus = currentItem?.status || "Новый";

          if (currentStatus !== "Отменен") {
            const reason = await requestPrompt({
              title: "Причина отмены",
              description: `Укажи причину отмены для позиции "${
                currentItem?.article || currentItem?.name || "без названия"
              }".`,
              confirmText: "Подтвердить отмену",
              inputLabel: "Причина",
              inputPlaceholder: "Например: поставщик снял с заказа",
            });

            if (!reason || !reason.trim()) {
              showToast("Отмена не выполнена", {
                description: "Для отмены поставки нужно указать причину.",
                variant: "error",
              });
              return;
            }

            setForm((prev) => {
              const updatedItems = [...prev.items];
              const current = updatedItems[index];

              updatedItems[index] = {
                ...current,
                status: "Отменен",
                canceledDate: getTodayDate(),
                deliveredDate: "",
              };

              return {
                ...prev,
                comment: hasComment(prev.comment)
                  ? appendCancellationComment({
                      comment: prev.comment,
                      authorName: user?.name || "Система",
                      item: currentItem || { article: "", name: "" },
                      reason,
                    })
                  : prev.comment,
                items: updatedItems,
              };
            });

            showToast("Позиция отменена", { variant: "success" });
            return;
          }
        }

        setForm((prev) => {
          const updatedItems = [...prev.items];
          const current = updatedItems[index];

          const nextItem = {
            ...current,
            [field]: value,
          } as ItemForm;

          if (field === "status") {
            if (value === "Поставлен") {
              nextItem.deliveredDate = current.deliveredDate || getTodayDate();
              nextItem.canceledDate = "";
            } else {
              nextItem.deliveredDate = "";
            }

            if (value === "Отменен") {
              nextItem.canceledDate = getTodayDate();
              nextItem.deliveredDate = "";
            } else if (value !== "Поставлен") {
              nextItem.canceledDate = "";
            }
          }

          if (field === "hasReplacement" && value === false) {
            nextItem.replacementArticle = "";
          }

          updatedItems[index] = nextItem;
          return { ...prev, items: updatedItems };
        });
      })();
    },
    [form.items, order?.order_items, requestPrompt, setForm, showToast, user]
  );

  const applyBulkPlannedDate = useCallback(() => {
    if (user?.role !== "admin") {
      return;
    }

    if (!form.bulkPlannedDate) {
      showToast("Плановая дата не выбрана", {
        description: "Сначала выбери плановую дату.",
        variant: "error",
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({
        ...item,
        plannedDate: prev.bulkPlannedDate,
      })),
    }));

    showToast("Дата применена", {
      description: "Плановая дата установлена для всех позиций.",
      variant: "success",
    });
  }, [form.bulkPlannedDate, setForm, showToast, user?.role]);

  const applyBulkStatus = useCallback(() => {
    if (user?.role === "buyer") {
      return;
    }

    if (!form.bulkStatus) {
      showToast("Статус не выбран", {
        description: "Сначала выбери статус.",
        variant: "error",
      });
      return;
    }

    if (form.bulkStatus === "Отменен") {
      void (async () => {
        const reason = await requestPrompt({
          title: "Причина отмены",
          description:
            "Укажи причину отмены для всех позиций, к которым будет применён статус.",
          confirmText: "Подтвердить отмену",
          inputLabel: "Причина",
          inputPlaceholder: "Например: поставщик снял с заказа",
        });

        if (!reason || !reason.trim()) {
          showToast("Отмена не выполнена", {
            description: "Для отмены поставки нужно указать причину.",
            variant: "error",
          });
          return;
        }

        setForm((prev) => ({
          ...prev,
          comment: hasComment(prev.comment)
            ? appendCommentEntries(
                prev.comment,
                prev.items.map((item) =>
                  appendCancellationComment({
                    comment: "",
                    authorName: user?.name || "Система",
                    item,
                    reason,
                  })
                )
              )
            : prev.comment,
          items: prev.items.map((item) => ({
            ...item,
            status: "Отменен",
            deliveredDate: "",
            canceledDate: getTodayDate(),
          })),
        }));

        showToast("Статус применён", {
          description: "Статус обновлён для всех позиций.",
          variant: "success",
        });
      })();
      return;
    }

    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({
        ...item,
        status: prev.bulkStatus,
        deliveredDate: prev.bulkStatus === "Поставлен" ? getTodayDate() : "",
        canceledDate: "",
      })),
    }));

    showToast("Статус применён", {
      description: "Статус обновлён для всех позиций.",
      variant: "success",
    });
  }, [form.bulkStatus, requestPrompt, setForm, showToast, user?.name, user?.role]);

  const saveOrder = useCallback(async () => {
    if (!user || !order) return;
    if (saving) return;

    if (user.role === "viewer") {
      showToast("Действие недоступно", {
        description: "Наблюдатель не может редактировать заказы.",
        variant: "error",
      });
      return;
    }

    if (!form.clientOrder) {
      showToast("Не заполнен номер заказа", {
        description: "Укажи номер клиентского заказа.",
        variant: "error",
      });
      return;
    }

    if (!form.supplierId) {
      showToast("Не выбран поставщик", {
        description: "Укажи поставщика для этого заказа.",
        variant: "error",
      });
      return;
    }

    setSaving(true);

    try {
      const validItems = getValidItems(form.items);
      if (validItems.length === 0) {
        showToast("Нет позиций", {
          description: "Добавь хотя бы одну позицию.",
          variant: "error",
        });
        return;
      }

      const autoCommentEntries = buildPlannedDateChangeComments({
        validItems,
        existingOrder: order,
        isEditing: true,
        authorName: user.name,
        normalizeDateForCompare,
      });

      for (const item of validItems) {
        const oldItem = item.id
          ? (order.order_items || []).find((existing) => existing.id === item.id) || null
          : null;

        if (
          user.role === "supplier" &&
          oldItem &&
          normalizeDateForCompare(oldItem.planned_date) !== normalizeDateForCompare(item.plannedDate) &&
          !canEditItemPlannedDate(user, oldItem)
        ) {
          showToast("Срок нельзя перенести", {
            description: `Позиция "${getItemLabel(
              item
            )}" ещё не ушла в просрочку. Поставщик не может заранее переносить плановую дату.`,
            variant: "error",
          });
          return;
        }

        if (item.hasReplacement && !item.replacementArticle.trim()) {
          showToast("Не заполнена замена", {
            description: `Для позиции "${getItemLabel(
              item
            )}" отмечена замена, но не указан актуальный артикул.`,
            variant: "error",
          });
          return;
        }

        if (item.status === "Поставлен" && !item.deliveredDate) {
          showToast("Нет даты поставки", {
            description: `Для позиции "${getItemLabel(
              item
            )}" со статусом "Поставлен" должна быть дата поставки.`,
            variant: "error",
          });
          return;
        }

        if (item.status === "Отменен" && !item.canceledDate) {
          showToast("Нет даты отмены", {
            description: `Для позиции "${getItemLabel(
              item
            )}" со статусом "Отменен" должна быть дата отмены.`,
            variant: "error",
          });
          return;
        }

        if (!item.id) {
          showToast("Нельзя добавлять новые позиции", {
            description: "В уже созданный заказ нельзя добавлять новые позиции.",
            variant: "error",
          });
          return;
        }
      }

      let nextComment = form.comment || "";
      if (autoCommentEntries.length > 0) {
        nextComment = appendCommentEntries(nextComment, autoCommentEntries);
      }
      if (form.newComment.trim()) {
        nextComment = mergeComments(nextComment, user.name, form.newComment);
      }

      const { error: orderError } = await updateOrderHeader(order.id, {
        client_order: form.clientOrder,
        order_date: form.orderDate || "",
        order_type: form.orderType,
        supplier_id: Number(form.supplierId),
        comment: nextComment,
        updated_by: user.name,
        updated_at: formatDateTimeForDb(),
      });

      if (orderError) {
        console.error("Ошибка обновления заказа:", orderError);
        showToast("Ошибка обновления заказа", {
          description: orderError.message,
          variant: "error",
        });
        return;
      }

      for (const item of validItems) {
        const previousItem =
          (order.order_items || []).find((existing) => existing.id === item.id) || null;
        const previousPlannedDate = normalizeDateForCompare(previousItem?.planned_date);
        const nextPlannedDate = normalizeDateForCompare(item.plannedDate);
        const plannedDateChanged = previousPlannedDate !== nextPlannedDate;
        const previousItemWasOverdue = previousItem ? isItemOverdue(previousItem) : false;
        const nextItemWillBeOverdue =
          !!nextPlannedDate &&
          nextPlannedDate < getTodayDate() &&
          item.status !== "Поставлен" &&
          item.status !== "Отменен" &&
          !item.deliveredDate &&
          !item.canceledDate;

        if (plannedDateChanged && previousItem) {
          if (previousItemWasOverdue || nextItemWillBeOverdue) {
            await registerFirstOverdueItem({
              order_item_id: previousItem.id,
              order_id: order.id,
              supplier_id: Number(form.supplierId) || null,
              first_planned_date:
                normalizeDateForCompare(
                  previousItem.initial_planned_date ||
                    (previousItemWasOverdue ? previousItem.planned_date : nextPlannedDate) ||
                    previousItem.planned_date
                ) ||
                null,
            });
          }

          await createPlannedDateHistoryEntry({
            order_item_id: previousItem.id,
            order_id: order.id,
            supplier_id: Number(form.supplierId) || null,
            previous_planned_date: previousPlannedDate || null,
            next_planned_date: nextPlannedDate || null,
            changed_by: user.name,
            changed_at: formatDateTimeForDb(),
            changed_after_overdue: previousItemWasOverdue,
          });
        }

        const nextItemPayload = {
          ...item,
          initialPlannedDate:
            item.initialPlannedDate ||
            previousItem?.initial_planned_date ||
            previousItem?.planned_date ||
            item.plannedDate ||
            "",
          plannedDateChangeCount:
            (previousItem?.planned_date_change_count || item.plannedDateChangeCount || 0) +
            (plannedDateChanged ? 1 : 0),
          plannedDateLastChangedAt: plannedDateChanged ? formatDateTimeForDb() : item.plannedDateLastChangedAt || previousItem?.planned_date_last_changed_at || "",
          plannedDateLastChangedBy: plannedDateChanged ? user.name : item.plannedDateLastChangedBy || previousItem?.planned_date_last_changed_by || "",
        };

        const { error } = await updateOrderItem(
          item.id!,
          buildOrderItemPayload(order.id, nextItemPayload)
        );

        if (error) {
          console.error("Ошибка обновления позиции:", error);
          showToast("Ошибка обновления позиции", {
            description: error.message,
            variant: "error",
          });
          return;
        }
      }

      const nextOrderSnapshot = {
        id: order.id,
        client_order: form.clientOrder,
        supplier_id: Number(form.supplierId),
        order_items: validItems.map((item) => ({
          id: item.id!,
          order_id: order.id,
          article: item.article,
          replacement_article: item.hasReplacement ? item.replacementArticle : null,
          name: item.name,
          quantity: item.quantity,
          planned_date: item.plannedDate || null,
          status: item.status,
          delivered_date: item.deliveredDate || null,
          canceled_date: item.canceledDate || null,
        })),
      };

      await notifyOrderChanged({
        beforeOrder: order,
        afterOrder: nextOrderSnapshot,
        updatedAtKey: formatDateTimeForDb(),
      }).catch(() => {});

      await loadOrder();
      showToast("Заказ обновлён", { variant: "success" });
    } finally {
      setSaving(false);
    }
  }, [form, loadOrder, order, saving, setSaving, showToast, user]);

  const removeOrder = useCallback(async () => {
    if (!user || !order) return;

    if (user.role !== "admin") {
      showToast("Удаление недоступно", {
        description: "Удалять заказы может только администратор.",
        variant: "error",
      });
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Удалить заказ?",
      description: "Это действие удалит заказ и все его позиции.",
      confirmText: "Удалить",
      variant: "danger",
    });

    if (!confirmed) return;

    setRemoving(true);
    try {
      const { error: itemsError } = await deleteItemsByOrderId(order.id);
      if (itemsError) {
        console.error("Ошибка удаления позиций:", itemsError);
        showToast("Ошибка удаления позиций", {
          description: itemsError.message,
          variant: "error",
        });
        return;
      }

      const { error: orderError } = await deleteOrderById(order.id);
      if (orderError) {
        console.error("Ошибка удаления заказа:", orderError);
        showToast("Ошибка удаления заказа", {
          description: orderError.message,
          variant: "error",
        });
        return;
      }

      showToast("Заказ удалён", { variant: "success" });
      routerPush("/");
    } finally {
      setRemoving(false);
    }
  }, [order, requestConfirmation, routerPush, setRemoving, showToast, user]);

  return {
    updateItemField,
    applyBulkPlannedDate,
    applyBulkStatus,
    saveOrder,
    removeOrder,
  };
}
