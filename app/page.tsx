"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { LoginForm } from "../components/orders/LoginForm";
import { OrderFormModal } from "../components/orders/OrderFormModal";
import { OrdersTable } from "../components/orders/OrdersTable";
import { OrdersToolbar } from "../components/orders/OrdersToolbar";
import { OrdersListMobile } from "../components/orders/OrdersListMobile";
import { QuickDateDialog } from "../components/orders/QuickDateDialog";
import { OrdersOverviewSkeleton } from "../components/orders/LoadingSkeletons";
import { MobileLaunchReveal } from "../components/ui/MobileLaunchReveal";
import { AppDialog } from "../components/ui/AppDialog";
import { MobileBottomNav } from "../components/ui/MobileBottomNav";
import { ToastViewport } from "../components/ui/ToastViewport";
import { AppLogo } from "../components/ui/AppLogo";
import { useOrdersAuthActions } from "../lib/auth/useOrdersAuthActions";
import { useProfileAuth } from "../lib/auth/useProfileAuth";
import {
  buildOrderItemPayload,
  createOrderHeader,
  createOrderItem,
  deleteItemsByOrderId,
  deleteOrderById,
  deleteOrderItems,
  fetchOrders,
  getExistingItemIds,
  markItemAsDelivered,
  updateItemQuickStatus,
  updateOrderHeader,
  updateOrderItem,
  updateOrderMetadata,
} from "../lib/orders/api";
import { EMPTY_ITEM } from "../lib/orders/constants";
import {
  appendCancellationComment,
  buildPlannedDateChangeComments,
  getItemLabel,
  getValidItems,
  hasOnlyEmptyItemRow,
  prepareImportedItems,
} from "../lib/orders/operations";
import {
  canComment,
  canCreateOrder,
  canEditItemMainFields,
  canEditItemStatusFields,
  canEditOrderDate,
  canEditOrderTextFields,
  canImportItems,
  canUseBulkActions,
} from "../lib/orders/permissions";
import { getFilteredAndSortedOrders, getOrdersStats } from "../lib/orders/selectors";
import type {
  ItemForm,
  OrderItem,
  OrderFormState,
  OrderWithItems,
  SortDirection,
  SortField,
} from "../lib/orders/types";
import { triggerHapticFeedback } from "../lib/ui/haptics";
import { useDialog } from "../lib/ui/useDialog";
import { useToast } from "../lib/ui/useToast";
import {
  appendCommentEntries,
  createEmptyOrderForm,
  formatDateTimeForDb,
  getOrderStatus,
  getTodayDate,
  hasComment,
  mergeComments,
  normalizeDateForCompare,
  parseComments,
  parseExcelItems,
} from "../lib/orders/utils";

const EMPTY_ORDER_FORM = createEmptyOrderForm(EMPTY_ITEM);

type QuickDateDialogState = {
  open: boolean;
  orderId: number | null;
  itemId: number | null;
  status: string;
  value: string;
  title: string;
  description?: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [form, setForm] = useState<OrderFormState>(EMPTY_ORDER_FORM);
  const isEditing = !!editingOrderId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedArticle, setCopiedArticle] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { user, setUser, authLoading, profileLoading, setProfileLoading } =
    useProfileAuth();

  const [loginForm, setLoginForm] = useState({
    login: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const { toasts, showToast, closeToast } = useToast();
  const {
    confirmDialog,
    promptDialog,
    setPromptDialog,
    requestConfirmation,
    closeConfirmDialog,
    requestPrompt,
    closePromptDialog,
  } = useDialog();

  const [quickDateDialog, setQuickDateDialog] = useState<QuickDateDialogState>({
    open: false,
    orderId: null,
    itemId: null,
    status: "",
    value: "",
    title: "",
    description: "",
  });

  const parsedComments = useMemo(() => parseComments(form.comment), [form.comment]);

  useEffect(() => {
    if (!copiedArticle) return;
    const timer = setTimeout(() => setCopiedArticle(null), 1500);
    return () => clearTimeout(timer);
  }, [copiedArticle]);

  const loadOrders = useCallback(async () => {
    setLoading(true);

    const { data, error } = await fetchOrders();

    if (error) {
      console.error("Ошибка загрузки:", error);
      showToast("Ошибка загрузки", {
        description: error.message,
        variant: "error",
      });
    } else {
      setOrders((data as OrderWithItems[]) || []);
    }

    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    if (user) {
      void loadOrders();
    } else {
      setOrders([]);
    }
  }, [user, loadOrders]);

  const filteredOrders = useMemo(() => {
    return getFilteredAndSortedOrders({
      orders,
      search,
      statusFilter,
      orderTypeFilter,
      sortField,
      sortDirection,
    });
  }, [orders, search, statusFilter, orderTypeFilter, sortField, sortDirection]);

  const stats = useMemo(() => getOrdersStats(orders), [orders]);

  const { login, logout } = useOrdersAuthActions({
    loginForm,
    setLoginError,
    setProfileLoading,
    setUser,
    setLoginForm,
    currentUser: user,
    showToast,
  });

  const resetForm = () => {
    setForm({
      ...createEmptyOrderForm(EMPTY_ITEM),
      orderDate: getTodayDate(),
      items: [{ ...EMPTY_ITEM }],
    });
    setEditingOrderId(null);
  };

  const openCreate = () => {
    if (!canCreateOrder(user)) return;

    setEditingOrderId(null);
    setForm({
      ...createEmptyOrderForm(EMPTY_ITEM),
      orderDate: getTodayDate(),
      items: [{ ...EMPTY_ITEM }],
    });
    setOpen(true);
  };

  const handleOpenCreateWithHaptic = () => {
    triggerHapticFeedback("medium");
    openCreate();
  };

  const handleLogoutWithHaptic = () => {
    triggerHapticFeedback("light");
    void logout();
  };

  const handleRefresh = () => {
    void loadOrders();
  };

  const updateItemField = (
    index: number,
    field: keyof ItemForm,
    value: string | boolean
  ) => {
    void (async () => {
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

            const nextItem = {
              ...current,
              status: "Отменен",
              canceledDate: getTodayDate(),
              deliveredDate: "",
            };

            updatedItems[index] = nextItem;

            return {
              ...prev,
              comment: appendCancellationComment({
                comment: prev.comment,
                authorName: user?.name || "Система",
                item: currentItem || { article: "", name: "" },
                reason,
              }),
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
            nextItem.deliveredDate = current.deliveredDate || "";
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
  };

  const applyBulkPlannedDate = () => {
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
  };

  const applyBulkStatus = () => {
    if (!form.bulkStatus) {
      showToast("Статус не выбран", {
        description: "Сначала выбери статус.",
        variant: "error",
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({
        ...item,
        status: prev.bulkStatus,
        deliveredDate: prev.bulkStatus === "Поставлен" ? getTodayDate() : "",
        canceledDate: prev.bulkStatus === "Отменен" ? getTodayDate() : "",
      })),
    }));

    showToast("Статус применён", {
      description: "Статус обновлён для всех позиций.",
      variant: "success",
    });
  };

  const addItemRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_ITEM }],
    }));
  };

  const removeItemRow = (index: number) => {
    setForm((prev) => {
      if (prev.items.length === 1) {
        return {
          ...prev,
          items: [{ ...EMPTY_ITEM }],
        };
      }

      return {
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      };
    });

    showToast("Позиция удалена", { variant: "info" });
  };

  const handleExcelUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
      });

      const importedItems = parseExcelItems(rows);

      if (importedItems.length === 0) {
        showToast("Импорт не выполнен", {
          description:
            "Проверь, чтобы в Excel были колонки Артикул, Наименование, Количество.",
          variant: "error",
        });
        return;
      }

      setForm((prev) => {
        const hasOnlyEmptyRow = hasOnlyEmptyItemRow(prev.items);
        const preparedItems = prepareImportedItems(
          importedItems,
          prev,
          canUseBulkActions(user)
        );

        return {
          ...prev,
          items: hasOnlyEmptyRow ? preparedItems : [...prev.items, ...preparedItems],
        };
      });

      showToast("Импорт выполнен", {
        description: `Загружено позиций: ${importedItems.length}`,
        variant: "success",
      });
    } catch (error) {
      console.error(error);
      showToast("Ошибка импорта", {
        description: "Не удалось прочитать Excel-файл.",
        variant: "error",
      });
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const saveForm = async () => {
    if (!user) return;
    if (saving) return;

    if (user.role === "viewer") {
      showToast("Действие недоступно", {
        description: "Наблюдатель не может редактировать заказы.",
        variant: "error",
      });
      return;
    }

    if (user.role === "supplier" && !editingOrderId) {
      showToast("Действие недоступно", {
        description: "Поставщик не может создавать новые заказы.",
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

      const existingOrder = editingOrderId
        ? orders.find((x) => x.id === editingOrderId) || null
        : null;

      const autoCommentEntries = buildPlannedDateChangeComments({
        validItems,
        existingOrder,
        isEditing,
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
      }

      if (isEditing) {
        const invalidItems = validItems.some((item) => !item.id);
        if (invalidItems) {
          showToast("Нельзя добавить новую позицию", {
            description: "Нельзя добавлять новые позиции в уже созданный заказ.",
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

      const nowTimestamp = formatDateTimeForDb();
      const orderDateForSave =
        user.role === "buyer"
          ? getTodayDate()
          : form.orderDate || getTodayDate();

      const headerPayload = {
        client_order: form.clientOrder,
        order_date: orderDateForSave,
        order_type: form.orderType,
        comment: nextComment,
        updated_by: user.name,
        updated_at: nowTimestamp,
      };

      let orderId = editingOrderId;

      if (editingOrderId) {
        const { error } = await updateOrderHeader(editingOrderId, headerPayload);

        if (error) {
          console.error("Ошибка обновления заказа:", error);
          showToast("Ошибка обновления заказа", {
            description: error.message,
            variant: "error",
          });
          return;
        }
      } else {
        const { data, error } = await createOrderHeader(headerPayload);

        if (error) {
          console.error("Ошибка создания заказа:", error);
          showToast("Ошибка создания заказа", {
            description: error.message,
            variant: "error",
          });
          return;
        }

        orderId = data.id;
      }

      if (!orderId) {
        showToast("Ошибка", {
          description: "Не удалось определить ID заказа.",
          variant: "error",
        });
        return;
      }

      const existingItemIds = getExistingItemIds(orders, orderId);
      const currentItemIds = validItems
        .map((item) => item.id)
        .filter(Boolean) as number[];

      const itemIdsToDelete = existingItemIds.filter((id) => !currentItemIds.includes(id));

      if (itemIdsToDelete.length > 0) {
        if (user.role !== "admin" || isEditing) {
          showToast("Удаление недоступно", {
            description: "Нельзя удалять позиции в уже созданном заказе.",
            variant: "error",
          });
          return;
        }

        const { error } = await deleteOrderItems(itemIdsToDelete);

        if (error) {
          console.error("Ошибка удаления позиций:", error);
          showToast("Ошибка удаления позиций", {
            description: error.message,
            variant: "error",
          });
          return;
        }
      }

      for (const item of validItems) {
        const itemPayload = buildOrderItemPayload(orderId, item);

        if (item.id) {
          const { error } = await updateOrderItem(item.id, itemPayload);

          if (error) {
            console.error("Ошибка обновления позиции:", error);
            showToast("Ошибка обновления позиции", {
              description: error.message,
              variant: "error",
            });
            return;
          }
        } else {
          const { error } = await createOrderItem(itemPayload);

          if (error) {
            console.error("Ошибка добавления позиции:", error);
            showToast("Ошибка добавления позиции", {
              description: error.message,
              variant: "error",
            });
            return;
          }
        }
      }

      setOpen(false);
      resetForm();
      await loadOrders();
      showToast(editingOrderId ? "Заказ обновлён" : "Заказ создан", {
        variant: "success",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeOrder = async (id: number) => {
    if (user?.role !== "admin") {
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

    const { error: itemsError } = await deleteItemsByOrderId(id);

    if (itemsError) {
      console.error("Ошибка удаления позиций:", itemsError);
      showToast("Ошибка удаления позиций", {
        description: itemsError.message,
        variant: "error",
      });
      return;
    }

    const { error: orderError } = await deleteOrderById(id);

    if (orderError) {
      console.error("Ошибка удаления заказа:", orderError);
      showToast("Ошибка удаления заказа", {
        description: orderError.message,
        variant: "error",
      });
      return;
    }

    setExpandedOrders((prev) => prev.filter((x) => x !== id));
    await loadOrders();
    showToast("Заказ удалён", { variant: "success" });
  };

  const openQuickDateDialog = (params: {
    orderId: number;
    itemId: number;
    status: string;
    title: string;
    description?: string;
    initialValue?: string | null;
  }) => {
    setQuickDateDialog({
      open: true,
      orderId: params.orderId,
      itemId: params.itemId,
      status: params.status,
      title: params.title,
      description: params.description,
      value: params.initialValue || getTodayDate(),
    });
  };

  const closeQuickDateDialog = () => {
    setQuickDateDialog({
      open: false,
      orderId: null,
      itemId: null,
      status: "",
      value: "",
      title: "",
      description: "",
    });
  };

  const confirmQuickDateDialog = async () => {
    if (!quickDateDialog.orderId || !quickDateDialog.itemId) return;

    const dateValue = quickDateDialog.value?.trim();

    if (!dateValue) {
      showToast("Дата не указана", {
        description: 'Для статуса "Поставлен" нужно выбрать дату поставки.',
        variant: "error",
      });
      return;
    }

    const validDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!validDatePattern.test(dateValue)) {
      showToast("Неверный формат даты", {
        description: "Выбери дату через календарь.",
        variant: "error",
      });
      return;
    }

    const currentOrder = orders.find((x) => x.id === quickDateDialog.orderId);
    const currentItem = currentOrder?.order_items?.find(
      (x) => x.id === quickDateDialog.itemId
    );

    if (!currentItem || !user) {
      closeQuickDateDialog();
      return;
    }

    let nextComment = currentOrder?.comment || "";
    const nowTimestamp = formatDateTimeForDb();

    const { error } = await markItemAsDelivered(quickDateDialog.itemId, dateValue);

    if (error) {
      console.error("Ошибка обновления статуса позиции:", error);
      showToast("Ошибка обновления статуса", {
        description: error.message,
        variant: "error",
      });
      return;
    }

    const { error: orderError } = await updateOrderMetadata({
      orderId: quickDateDialog.orderId,
      updatedBy: user.name,
      updatedAt: nowTimestamp,
      comment: nextComment,
    });

    if (orderError) {
      console.error("Ошибка обновления заказа:", orderError);
      showToast("Ошибка обновления заказа", {
        description: orderError.message,
        variant: "error",
      });
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === quickDateDialog.orderId
          ? {
              ...order,
              updated_by: user.name,
              updated_at: nowTimestamp,
              comment: nextComment,
              order_items: (order.order_items || []).map((row) =>
                row.id === quickDateDialog.itemId
                  ? {
                      ...row,
                      status: "Поставлен",
                      delivered_date: dateValue,
                      canceled_date: null,
                    }
                  : row
              ),
            }
          : order
      )
    );

    closeQuickDateDialog();
    showToast("Статус обновлён", { variant: "success" });
  };

  const updateItemStatusQuick = async (
    orderId: number,
    item: OrderItem,
    newStatus: string
  ) => {
    if (!user) return;

    if (user.role === "viewer") {
      showToast("Действие недоступно", {
        description: "Наблюдатель не может менять статус.",
        variant: "error",
      });
      return;
    }

    if (newStatus === "Поставлен") {
      openQuickDateDialog({
        orderId,
        itemId: item.id,
        status: "Поставлен",
        title: "Дата поставки",
        description: `Выбери дату поставки для позиции "${item.article || item.name || "без названия"}".`,
        initialValue: item.delivered_date || getTodayDate(),
      });
      return;
    }

    let nextComment = orders.find((x) => x.id === orderId)?.comment || "";
    const nowTimestamp = formatDateTimeForDb();
    const today = getTodayDate();

    const itemUpdatePayload: {
      status: string;
      delivered_date?: string | null;
      canceled_date?: string | null;
    } = { status: newStatus };

    if (newStatus === "Отменен") {
      const reason = await requestPrompt({
        title: "Причина отмены",
        description: `Укажи причину отмены для позиции "${
          item.article || item.name || "без названия"
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

      nextComment = appendCancellationComment({
        comment: nextComment,
        authorName: user.name,
        item,
        reason,
      });

      itemUpdatePayload.canceled_date = today;
      itemUpdatePayload.delivered_date = null;
    }

    if (newStatus !== "Отменен") {
      itemUpdatePayload.delivered_date = null;
      itemUpdatePayload.canceled_date = null;
    }

    const { error } = await updateItemQuickStatus(item.id, itemUpdatePayload);

    if (error) {
      console.error("Ошибка обновления статуса позиции:", error);
      showToast("Ошибка обновления статуса", {
        description: error.message,
        variant: "error",
      });
      return;
    }

    const { error: orderError } = await updateOrderMetadata({
      orderId,
      updatedBy: user.name,
      updatedAt: nowTimestamp,
      comment: nextComment,
    });

    if (orderError) {
      console.error("Ошибка обновления заказа:", orderError);
      showToast("Ошибка обновления заказа", {
        description: orderError.message,
        variant: "error",
      });
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              updated_by: user.name,
              updated_at: nowTimestamp,
              comment: nextComment,
              order_items: (order.order_items || []).map((row) =>
                row.id === item.id
                  ? {
                      ...row,
                      status: newStatus,
                      delivered_date: null,
                      canceled_date: newStatus === "Отменен" ? today : null,
                    }
                  : row
              ),
            }
          : order
      )
    );

    showToast("Статус обновлён", { variant: "success" });
  };

  const copyArticle = async (article: string | null) => {
    if (!article) return;

    try {
      await navigator.clipboard.writeText(article);
      setCopiedArticle(article);
      showToast("Артикул скопирован", { variant: "success" });
    } catch {
      showToast("Не удалось скопировать артикул", { variant: "error" });
    }
  };

  const toggleOrderExpand = (orderId: number) => {
    setExpandedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((x) => x !== orderId)
        : [...prev, orderId]
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <ToastViewport toasts={toasts} onClose={closeToast} />
        <LoginForm
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          loginError={loginError}
          onLogin={login}
        />
      </>
    );
  }

  return (
    <>
      <MobileLaunchReveal />
      <ToastViewport toasts={toasts} onClose={closeToast} />

      <AppDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={() => closeConfirmDialog(true)}
        onCancel={() => closeConfirmDialog(false)}
      />

      <AppDialog
        open={promptDialog.open}
        title={promptDialog.title}
        description={promptDialog.description}
        confirmText={promptDialog.confirmText}
        inputLabel={promptDialog.inputLabel}
        inputPlaceholder={promptDialog.inputPlaceholder}
        inputValue={promptDialog.value}
        onInputChange={(value) =>
          setPromptDialog((prev) => ({
            ...prev,
            value,
          }))
        }
        onConfirm={() => closePromptDialog(promptDialog.value)}
        onCancel={() => closePromptDialog(null)}
      />

      <QuickDateDialog
        dialog={quickDateDialog}
        setDialog={setQuickDateDialog}
        closeDialog={closeQuickDateDialog}
        confirmDialog={confirmQuickDateDialog}
      />

      <div className="min-h-screen bg-slate-100/80 p-2 md:p-8">
        <div className="bottom-nav-safe mx-auto max-w-7xl space-y-3 md:space-y-7 md:pb-0">
          <div className="premium-enter overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.08)] md:rounded-[28px]">
            <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-3.5 py-3.5 text-white md:px-8 md:py-7">
              <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_55%)] pointer-events-none" />

              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-4 md:gap-6">
                    <div className="shrink-0 pt-1">
                      <AppLogo compact showText={false} />
                    </div>

                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-200 md:px-3 md:text-[11px]">
                        Центр управления заказами
                      </div>

                      <h1 className="mt-2 text-[19px] font-semibold tracking-tight text-white md:mt-2.5 md:text-[30px] md:leading-[1.02]">
                        Общая таблица заказов
                      </h1>

                      <p className="mt-1.5 max-w-3xl text-[12px] leading-[1.1rem] text-slate-300 md:mt-3 md:text-[17px] md:leading-6">
                        Система обработки и мониторинга заказов Автодом – Союз.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col gap-2.5 lg:min-w-[320px] lg:items-end">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                    <div className="rounded-[18px] border border-white/15 bg-white/10 px-2.5 py-1.5 text-[12px] text-white backdrop-blur md:rounded-2xl md:px-4 md:py-2.5 md:text-sm">
                      {profileLoading
                        ? "Загрузка профиля..."
                        : `${user.name} · ${
                            user.role === "admin"
                              ? "Администратор"
                              : user.role === "supplier"
                              ? "Поставщик"
                              : user.role === "buyer"
                              ? "Покупатель"
                              : "Наблюдатель"
                          }`}
                    </div>

                    <button
                      onClick={handleLogoutWithHaptic}
                      className="rounded-[18px] border border-white/15 bg-white/5 px-2.5 py-1.5 text-[12px] font-medium text-slate-100 transition hover:bg-white/10 md:rounded-2xl md:px-4 md:py-2.5 md:text-sm"
                    >
                      Выйти
                    </button>
                  </div>

                  {user.role === "admin" || user.role === "buyer" ? (
                    <button
                      onClick={handleOpenCreateWithHaptic}
                      className="w-full rounded-[18px] bg-white px-4 py-2 text-[12px] font-semibold text-slate-900 transition hover:bg-slate-100 lg:w-auto md:rounded-2xl md:px-5 md:py-3 md:text-sm"
                    >
                      Добавить заказ
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="premium-enter premium-enter-delay-1">
              <OrdersOverviewSkeleton />
            </div>
          ) : (
            <>
              <div className="premium-enter premium-enter-delay-1">
                <OrdersToolbar
                  stats={stats}
                  search={search}
                  setSearch={setSearch}
                  orderTypeFilter={orderTypeFilter}
                  setOrderTypeFilter={setOrderTypeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  setSortField={setSortField}
                  setSortDirection={setSortDirection}
                />
              </div>

              <div className="premium-enter premium-enter-delay-2 hidden md:block">
                <OrdersTable
                  loading={loading}
                  orders={filteredOrders}
                  expandedOrders={expandedOrders}
                  copiedArticle={copiedArticle}
                  user={user}
                  toggleOrderExpand={toggleOrderExpand}
                  removeOrder={removeOrder}
                  updateItemStatusQuick={updateItemStatusQuick}
                  copyArticle={copyArticle}
                />
              </div>

              <div className="premium-enter premium-enter-delay-2 md:hidden">
                <OrdersListMobile
                  loading={loading}
                  orders={filteredOrders}
                  expandedOrders={expandedOrders}
                  copiedArticle={copiedArticle}
                  user={user}
                  toggleOrderExpand={toggleOrderExpand}
                  removeOrder={removeOrder}
                  updateItemStatusQuick={updateItemStatusQuick}
                  copyArticle={copyArticle}
                />
              </div>
            </>
          )}

          <OrderFormModal
            open={open}
            saving={saving}
            editingOrderId={editingOrderId}
            userRole={user.role}
            form={form}
            parsedComments={parsedComments}
            fileInputRef={fileInputRef}
            canEditOrderTextFields={canEditOrderTextFields(user)}
            canEditItemMainFields={canEditItemMainFields(user)}
            canImportItems={canImportItems(user)}
            canEditItemStatusFields={canEditItemStatusFields(user)}
            canComment={canComment(user)}
            canUseBulkActions={canUseBulkActions(user)}
            canEditOrderDate={canEditOrderDate(user)}
            setOpen={setOpen}
            setForm={setForm}
            applyBulkPlannedDate={applyBulkPlannedDate}
            applyBulkStatus={applyBulkStatus}
            handleExcelUpload={handleExcelUpload}
            addItemRow={addItemRow}
            updateItemField={updateItemField}
            removeItemRow={removeItemRow}
            saveForm={saveForm}
          />
        </div>
      </div>

      <MobileBottomNav
        items={[
          {
            label: "Заказы",
            href: "/",
            active: true,
            haptic: "light",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6H20" />
                <path d="M4 12H20" />
                <path d="M4 18H14" />
              </svg>
            ),
          },
          canCreateOrder(user)
            ? {
                label: "Новый",
                onClick: openCreate,
                tone: "accent" as const,
                haptic: "medium" as const,
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5V19" />
                    <path d="M5 12H19" />
                  </svg>
                ),
              }
            : {
                label: "Обновить",
                onClick: handleRefresh,
                haptic: "light" as const,
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 12A8 8 0 1 1 17.5 6.2" />
                    <path d="M20 4V10H14" />
                  </svg>
                ),
              },
          {
            label: "Выход",
            onClick: () => void logout(),
            haptic: "light",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3H6V21H15" />
                <path d="M10 12H21" />
                <path d="M18 9L21 12L18 15" />
              </svg>
            ),
          },
        ]}
      />
    </>
  );
}
