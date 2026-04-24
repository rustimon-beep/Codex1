"use client";

import { useCallback } from "react";
import {
  buildOrderItemPayload,
  deleteItemsByOrderId,
  deleteOrderById,
  updateOrderHeader,
  updateOrderItem,
} from "./api";
import {
  appendCancellationComment,
  buildPlannedDateChangeComments,
  getItemLabel,
  getValidItems,
} from "./operations";
import type { ItemForm, OrderFormState, OrderWithItems, UserProfile } from "./types";
import { appendCommentEntries, formatDateTimeForDb, getTodayDate, hasComment, mergeComments, normalizeDateForCompare } from "./utils";

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
        if (user?.role === "buyer") {
          if (field === "status") {
            setForm((prev) => {
              const updatedItems = [...prev.items];
              const current = updatedItems[index];

              const nextItem = {
                ...current,
                status: String(value),
              } as ItemForm;

              if (value === "Поставлен") {
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

              updatedItems[index] = nextItem;
              return { ...prev, items: updatedItems };
            });
            return;
          }

          if (field === "deliveredDate") {
            setForm((prev) => {
              const updatedItems = [...prev.items];
              const current = updatedItems[index];
              updatedItems[index] = {
                ...current,
                deliveredDate: String(value),
              };
              return { ...prev, items: updatedItems };
            });
          }
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
    [form.items, requestPrompt, setForm, showToast, user]
  );

  const applyBulkPlannedDate = useCallback(() => {
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
  }, [form.bulkPlannedDate, setForm, showToast]);

  const applyBulkStatus = useCallback(() => {
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
  }, [form.bulkStatus, requestPrompt, setForm, showToast, user?.name]);

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
        const { error } = await updateOrderItem(
          item.id!,
          buildOrderItemPayload(order.id, item)
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
