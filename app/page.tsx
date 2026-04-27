"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { LoginForm } from "../components/orders/LoginForm";
import { OrderFormModal } from "../components/orders/OrderFormModal";
import { OrdersTable } from "../components/orders/OrdersTable";
import { OrdersToolbar } from "../components/orders/OrdersToolbar";
import { OrdersListMobile } from "../components/orders/OrdersListMobile";
import { OrdersAttentionWidget } from "../components/orders/OrdersAttentionWidget";
import { CreateOrderMethodDialog } from "../components/orders/CreateOrderMethodDialog";
import { QuickDateDialog } from "../components/orders/QuickDateDialog";
import { OrdersOverviewSkeleton } from "../components/orders/LoadingSkeletons";
import { MobileLaunchReveal } from "../components/ui/MobileLaunchReveal";
import { AppDialog } from "../components/ui/AppDialog";
import { MobileBottomNav } from "../components/ui/MobileBottomNav";
import { ToastViewport } from "../components/ui/ToastViewport";
import { AppLogo } from "../components/ui/AppLogo";
import { EmptyStateCard } from "../components/ui/EmptyStateCard";
import { NotificationPrompt } from "../components/ui/NotificationPrompt";
import { useOrdersAuthActions } from "../lib/auth/useOrdersAuthActions";
import { useProfileAuth } from "../lib/auth/useProfileAuth";
import {
  notifyNewOrderCreated,
  notifyOrderChanged,
} from "../lib/notifications/api";
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
import { fetchSuppliers, mapSuppliers } from "../lib/suppliers/api";
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
  canEditItemPlannedDate,
  canEditItemStatusFields,
  canEditOrderDate,
  canEditOrderTextFields,
  canUseBulkActions,
  canUseBulkPlannedDateActions,
  canUseBulkStatusActions,
} from "../lib/orders/permissions";
import {
  getFilteredAndSortedOrders,
  getOrdersAttention,
  getOrdersStats,
} from "../lib/orders/selectors";
import type {
  ItemForm,
  OrderItem,
  OrderFormState,
  OrderWithItems,
  SupplierSummary,
  SortDirection,
  SortField,
} from "../lib/orders/types";
import { triggerHapticFeedback } from "../lib/ui/haptics";
import { useDialog } from "../lib/ui/useDialog";
import { useOrdersNotifications } from "../lib/ui/notifications";
import {
  getFriendlyErrorMessage,
  isOffline,
  normalizeToastOptions,
  useConnectionFeedback,
} from "../lib/ui/network";
import { useToast } from "../lib/ui/useToast";
import {
  appendCommentEntries,
  createEmptyOrderForm,
  formatDateTimeForDb,
  getImportedItemIssues,
  getOrderStatus,
  getTodayDate,
  hasComment,
  mergeComments,
  normalizeDateForCompare,
  parseComments,
  parseClipboardItems,
  parseExcelItems,
} from "../lib/orders/utils";
import {
  normalizeRecognizedItems,
  prepareImageFileForUpload,
} from "../lib/orders/photo-import";

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
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [supplierTab, setSupplierTab] = useState("all");
  const [importReview, setImportReview] = useState<{
    source: "photo" | "excel" | "clipboard";
    importedCount: number;
  } | null>(null);
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
  const [photoParsing, setPhotoParsing] = useState(false);
  const [photoGuideOpen, setPhotoGuideOpen] = useState(false);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreviewUrl, setPendingPhotoPreviewUrl] = useState<string | null>(null);
  const [excelImporting, setExcelImporting] = useState(false);
  const [copiedArticle, setCopiedArticle] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<number[]>([]);
  const [showAttentionPanel, setShowAttentionPanel] = useState(false);
  const [createMethodOpen, setCreateMethodOpen] = useState(false);
  const [modalInitialSnapshot, setModalInitialSnapshot] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { user, setUser, authLoading, profileLoading, setProfileLoading } =
    useProfileAuth();

  const [loginForm, setLoginForm] = useState({
    login: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const { toasts, showToast: baseShowToast, closeToast } = useToast();
  const showToast = useCallback(
    (
      title: string,
      options?: { description?: string; variant?: "success" | "error" | "info" }
    ) => {
      baseShowToast(title, normalizeToastOptions(options));
    },
    [baseShowToast]
  );
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
  const serializeOrderForm = useCallback(
    (value: OrderFormState) =>
      JSON.stringify({
        ...value,
        items: value.items.map((item) => ({
          ...item,
          importSource: item.importSource || null,
          importIssues: item.importIssues || [],
        })),
      }),
    []
  );
  const isFormDirty =
    open && modalInitialSnapshot !== "" && serializeOrderForm(form) !== modalInitialSnapshot;

  useConnectionFeedback(showToast);

  useEffect(() => {
    if (!copiedArticle) return;
    const timer = setTimeout(() => setCopiedArticle(null), 1500);
    return () => clearTimeout(timer);
  }, [copiedArticle]);

  const loadOrders = useCallback(async () => {
    setLoading(true);

    const { data, error } = await fetchOrders(user);

    if (error) {
      console.error("Ошибка загрузки:", error);
      showToast("Ошибка загрузки", {
        description: getFriendlyErrorMessage(
          error,
          "Не удалось загрузить список заказов."
        ),
        variant: "error",
      });
    } else {
      setOrders((data as OrderWithItems[]) || []);
    }

    setLoading(false);
  }, [showToast, user]);

  const loadSuppliers = useCallback(async () => {
    const { data, error } = await fetchSuppliers();

    if (error) {
      console.error("Ошибка загрузки поставщиков:", error);
      return;
    }

    setSuppliers(mapSuppliers(data as SupplierSummary[]));
  }, []);

  useEffect(() => {
    if (user) {
      void loadOrders();
    } else {
      setOrders([]);
    }
  }, [user, loadOrders]);

  useEffect(() => {
    if (!user || user.role === "supplier") {
      setSuppliers([]);
      return;
    }

    void loadSuppliers();
  }, [loadSuppliers, user]);

  const supplierScopedOrders = useMemo(() => {
    if (user?.role === "supplier") return orders;
    if (supplierTab === "all") return orders;
    if (supplierTab === "unassigned") {
      return orders.filter((order) => !order.supplier_id);
    }

    return orders.filter((order) => String(order.supplier_id || "") === supplierTab);
  }, [orders, supplierTab, user?.role]);

  const filteredOrders = useMemo(() => {
    return getFilteredAndSortedOrders({
      orders: supplierScopedOrders,
      search,
      statusFilter,
      orderTypeFilter,
      sortField,
      sortDirection,
    });
  }, [supplierScopedOrders, search, statusFilter, orderTypeFilter, sortField, sortDirection]);

  const stats = useMemo(() => getOrdersStats(supplierScopedOrders), [supplierScopedOrders]);
  const attention = useMemo(() => getOrdersAttention(supplierScopedOrders), [supplierScopedOrders]);
  const notifications = useOrdersNotifications({
    orders,
    userId: user?.id || null,
    userRole: user?.role || "viewer",
    showToast,
  });
  const hasAttentionItems = attention.cards.some((card) => card.count > 0);
  const supplierTabs = useMemo(() => {
    const baseTabs = [{ id: "all", label: "Все поставщики", count: orders.length }];
    const assignedTabs = suppliers.map((supplier) => ({
      id: String(supplier.id),
      label: supplier.name,
      count: orders.filter((order) => order.supplier_id === supplier.id).length,
    }));
    const unassignedCount = orders.filter((order) => !order.supplier_id).length;

    if (unassignedCount > 0) {
      assignedTabs.push({
        id: "unassigned",
        label: "Без поставщика",
        count: unassignedCount,
      });
    }

    return [...baseTabs, ...assignedTabs];
  }, [orders, suppliers]);

  useEffect(() => {
    if (user?.role === "supplier") {
      setSupplierTab("all");
      return;
    }

    if (!supplierTabs.some((tab) => tab.id === supplierTab)) {
      setSupplierTab("all");
    }
  }, [supplierTab, supplierTabs, user?.role]);
  const currentImportReview = useMemo(() => {
    if (!importReview) return null;

    return {
      ...importReview,
      reviewCount: form.items.filter((item) => (item.importIssues || []).length > 0).length,
    };
  }, [form.items, importReview]);

  const { login, logout } = useOrdersAuthActions({
    loginForm,
    setLoginError,
    setProfileLoading,
    setUser,
    setLoginForm,
    currentUser: user,
    showToast,
  });

  const resetForm = useCallback(() => {
    setForm({
      ...createEmptyOrderForm(EMPTY_ITEM),
      orderDate: getTodayDate(),
      items: [{ ...EMPTY_ITEM }],
    });
    setModalInitialSnapshot("");
    setEditingOrderId(null);
  }, []);

  const prepareCreateDraft = useCallback(() => {
    if (!canCreateOrder(user)) return;

    setEditingOrderId(null);
    setImportReview(null);
    setForm({
      ...createEmptyOrderForm(EMPTY_ITEM),
      orderDate: getTodayDate(),
      items: [{ ...EMPTY_ITEM }],
    });
    setModalInitialSnapshot("");
  }, [user]);

  const openCreate = useCallback(() => {
    if (!canCreateOrder(user)) return;

    prepareCreateDraft();
    setOpen(true);
  }, [prepareCreateDraft, user]);

  useEffect(() => {
    if (!open || modalInitialSnapshot !== "") return;
    setModalInitialSnapshot(serializeOrderForm(form));
  }, [form, modalInitialSnapshot, open, serializeOrderForm]);

  useEffect(() => {
    if (!open || !isFormDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [open, isFormDirty]);

  const requestCloseModal = useCallback(async () => {
    if (saving || photoParsing) return;

    if (!isFormDirty) {
      setOpen(false);
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Закрыть без сохранения?",
      description:
        "Есть несохранённые изменения. Если закрыть окно сейчас, они потеряются.",
      confirmText: "Закрыть без сохранения",
      variant: "danger",
    });

    if (!confirmed) return;

    setOpen(false);
    resetForm();
    setImportReview(null);
  }, [isFormDirty, photoParsing, requestConfirmation, resetForm, saving]);

  const handleOpenCreateWithHaptic = () => {
    triggerHapticFeedback("medium");
    setCreateMethodOpen(true);
  };

  const handleSelectCreateMethod = (
    mode: "manual" | "photo" | "excel" | "clipboard"
  ) => {
    setCreateMethodOpen(false);

    if (mode === "manual") {
      openCreate();
      return;
    }

    prepareCreateDraft();

    window.setTimeout(() => {
      if (mode === "photo") {
        setPhotoGuideOpen(true);
      } else if (mode === "clipboard") {
        void handleClipboardImport();
      } else {
        fileInputRef.current?.click();
      }
    }, 120);
  };

  const openPhotoPicker = () => {
    setPhotoGuideOpen(false);
    window.setTimeout(() => {
      photoInputRef.current?.click();
    }, 120);
  };

  const closePhotoPreview = () => {
    if (pendingPhotoPreviewUrl) {
      URL.revokeObjectURL(pendingPhotoPreviewUrl);
    }
    setPendingPhotoPreviewUrl(null);
    setPendingPhotoFile(null);
    setPhotoPreviewOpen(false);
  };

  const handleClipboardImport = async () => {
    if (isOffline()) {
      showToast("Нет соединения", {
        description: "Интернет недоступен. Попробуй импорт из буфера чуть позже.",
        variant: "error",
      });
      return;
    }

    if (!navigator.clipboard?.readText) {
      showToast("Буфер недоступен", {
        description: "Браузер не дал доступ к буферу обмена.",
        variant: "error",
      });
      return;
    }

    try {
      const rawText = await navigator.clipboard.readText();
      const importedItems = parseClipboardItems(rawText);

      if (importedItems.length === 0) {
        showToast("Буфер не распознан", {
          description:
            "Скопируй строки с артикулом, наименованием и количеством, потом попробуй ещё раз.",
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
      setImportReview({
        source: "clipboard",
        importedCount: importedItems.length,
      });
      setOpen(true);

      showToast("Буфер обработан", {
        description: `Добавлено позиций: ${importedItems.length}`,
        variant: "success",
      });
    } catch (error) {
      showToast("Ошибка буфера обмена", {
        description: getFriendlyErrorMessage(
          error,
          "Не удалось прочитать буфер обмена."
        ),
        variant: "error",
      });
    }
  };

  const handleLogoutWithHaptic = () => {
    triggerHapticFeedback("light");
    void logout();
  };

  const handleRefresh = () => {
    void loadOrders();
  };

  const applyFocusFilter = useCallback(
    (params: {
      statusFilter: string;
      orderTypeFilter: string;
      sortField: SortField;
      sortDirection: SortDirection;
    }) => {
      setSearch("");
      setStatusFilter(params.statusFilter);
      setOrderTypeFilter(params.orderTypeFilter);
      setSortField(params.sortField);
      setSortDirection(params.sortDirection);
    },
    []
  );

  const updateItemField = (
    index: number,
    field: keyof ItemForm,
    value: string | boolean
  ) => {
    void (async () => {
      if (user?.role === "buyer" && field === "status") {
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

        if (nextItem.importSource) {
          nextItem.importIssues = getImportedItemIssues(nextItem);
        }

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
    if (!canUseBulkPlannedDateActions(user)) {
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
  };

  const applyBulkStatus = () => {
    if (!canUseBulkStatusActions(user)) {
      return;
    }

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

  const duplicateItemRow = (index: number) => {
    setForm((prev) => {
      const currentItem = prev.items[index];
      if (!currentItem) return prev;

      const duplicatedItem: ItemForm = {
        ...currentItem,
        id: undefined,
        importIssues: currentItem.importSource ? getImportedItemIssues(currentItem) : [],
      };

      const nextItems = [...prev.items];
      nextItems.splice(index + 1, 0, duplicatedItem);

      return {
        ...prev,
        items: nextItems,
      };
    });

    showToast("Позиция дублирована", { variant: "success" });
  };

  const clearItemRow = (index: number) => {
    setForm((prev) => {
      const currentItem = prev.items[index];
      if (!currentItem) return prev;

      const nextItem: ItemForm = {
        ...EMPTY_ITEM,
        importSource: currentItem.importSource,
        importIssues: currentItem.importSource
          ? ["Нет артикула", "Нет наименования", "Нет количества"]
          : [],
      };

      const nextItems = [...prev.items];
      nextItems[index] = nextItem;

      return {
        ...prev,
        items: nextItems,
      };
    });

    showToast("Строка очищена", { variant: "info" });
  };

  const keepOnlyProblemItems = () => {
    setForm((prev) => {
      const problemItems = prev.items.filter((item) => (item.importIssues || []).length > 0);

      if (problemItems.length === 0) {
        return prev;
      }

      return {
        ...prev,
        items: problemItems,
      };
    });

    showToast("Оставлены проблемные строки", {
      description: "В форме остались только позиции, которые требуют проверки.",
      variant: "info",
    });
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

    setExcelImporting(true);

    try {
      if (isOffline()) {
        throw new Error("offline");
      }

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
      setImportReview({
        source: "excel",
        importedCount: importedItems.length,
      });
      setOpen(true);

      showToast("Импорт выполнен", {
        description: `Загружено позиций: ${importedItems.length}`,
        variant: "success",
      });
    } catch (error) {
      console.error(error);
      showToast("Ошибка импорта", {
        description: getFriendlyErrorMessage(
          error,
          "Не удалось прочитать Excel-файл."
        ),
        variant: "error",
      });
    } finally {
      setExcelImporting(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const processPhotoFile = async (file: File) => {
    setPhotoParsing(true);

    try {
      if (isOffline()) {
        throw new Error("offline");
      }

      const preparedFile = await prepareImageFileForUpload(file);
      const formData = new FormData();
      formData.append("file", preparedFile, preparedFile.name);

      const response = await fetch("/api/orders/parse-photo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Не удалось распознать фото.");
      }

      const recognizedItems = normalizeRecognizedItems(result?.items || []);

      if (recognizedItems.length === 0) {
        showToast("Фото не распознано", {
          description: result?.notes
            ? "Текст с фото считался, но строки не удалось уверенно разобрать на артикул, наименование и количество."
            : "OCR почти ничего не увидел на фото. Попробуй более ровный снимок и хороший свет.",
          variant: "error",
        });
        return;
      }

      setForm((prev) => {
        const hasOnlyEmptyRow = hasOnlyEmptyItemRow(prev.items);
        const preparedItems = prepareImportedItems(
          recognizedItems,
          prev,
          canUseBulkActions(user)
        );

        return {
          ...prev,
          items: hasOnlyEmptyRow ? preparedItems : [...prev.items, ...preparedItems],
        };
      });
      setImportReview({
        source: "photo",
        importedCount: recognizedItems.length,
      });
      setOpen(true);

      showToast("Фото обработано", {
        description: `Добавлено позиций: ${recognizedItems.length}`,
        variant: "success",
      });
    } catch (error) {
      showToast("Ошибка распознавания фото", {
        description: getFriendlyErrorMessage(
          error,
          "Не удалось обработать фото."
        ),
        variant: "error",
      });
    } finally {
      setPhotoParsing(false);
    }
  };

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (pendingPhotoPreviewUrl) {
      URL.revokeObjectURL(pendingPhotoPreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingPhotoFile(file);
    setPendingPhotoPreviewUrl(previewUrl);
    setPhotoPreviewOpen(true);

    if (event.target) {
      event.target.value = "";
    }
  };

  const confirmPhotoPreview = () => {
    if (!pendingPhotoFile) return;

    const file = pendingPhotoFile;
    closePhotoPreview();
    void processPhotoFile(file);
  };

  const saveForm = async () => {
    if (!user) return;
    if (saving) return;

    if (isOffline()) {
      showToast("Нет соединения", {
        description: "Сейчас интернет недоступен. Сохранить заказ не получится.",
        variant: "error",
      });
      return;
    }

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

    if (!form.supplierId) {
      showToast("Не выбран поставщик", {
        description: "Для заказа нужно выбрать поставщика.",
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
        supplier_id: Number(form.supplierId),
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
            description: getFriendlyErrorMessage(
              error,
              "Не удалось обновить шапку заказа."
            ),
            variant: "error",
          });
          return;
        }
      } else {
        const { data, error } = await createOrderHeader(headerPayload);

        if (error) {
          console.error("Ошибка создания заказа:", error);
          showToast("Ошибка создания заказа", {
            description: getFriendlyErrorMessage(
              error,
              "Не удалось создать заказ."
            ),
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

      const savedOrderId = orderId;

      const existingItemIds = getExistingItemIds(orders, savedOrderId);
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
            description: getFriendlyErrorMessage(
              error,
              "Не удалось удалить лишние позиции."
            ),
            variant: "error",
          });
          return;
        }
      }

      for (const item of validItems) {
        const itemPayload = buildOrderItemPayload(savedOrderId, item);

        if (item.id) {
          const { error } = await updateOrderItem(item.id, itemPayload);

          if (error) {
            console.error("Ошибка обновления позиции:", error);
            showToast("Ошибка обновления позиции", {
              description: getFriendlyErrorMessage(
                error,
                "Не удалось обновить одну из позиций."
              ),
              variant: "error",
            });
            return;
          }
        } else {
          const { error } = await createOrderItem(itemPayload);

          if (error) {
            console.error("Ошибка добавления позиции:", error);
            showToast("Ошибка добавления позиции", {
              description: getFriendlyErrorMessage(
                error,
                "Не удалось добавить одну из позиций."
              ),
              variant: "error",
            });
            return;
          }
        }
      }

      setOpen(false);
      resetForm();
      await loadOrders();

      if (!editingOrderId) {
        await notifyNewOrderCreated({
          orderId: savedOrderId,
          clientOrder: form.clientOrder,
          supplierId: Number(form.supplierId),
        }).catch(() => {});
      } else if (existingOrder) {
        const nextOrderSnapshot = {
          id: savedOrderId,
          client_order: form.clientOrder,
          supplier_id: Number(form.supplierId),
          order_items: validItems.map((item) => ({
            id: item.id!,
            order_id: savedOrderId,
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
          beforeOrder: existingOrder,
          afterOrder: nextOrderSnapshot,
          updatedAtKey: nowTimestamp,
        }).catch(() => {});
      }

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
        description: getFriendlyErrorMessage(
          itemsError,
          "Не удалось удалить позиции заказа."
        ),
        variant: "error",
      });
      return;
    }

    const { error: orderError } = await deleteOrderById(id);

    if (orderError) {
      console.error("Ошибка удаления заказа:", orderError);
      showToast("Ошибка удаления заказа", {
        description: getFriendlyErrorMessage(
          orderError,
          "Не удалось удалить заказ."
        ),
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
        description: getFriendlyErrorMessage(
          error,
          "Не удалось обновить статус позиции."
        ),
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
        description: getFriendlyErrorMessage(
          orderError,
          "Не удалось обновить служебные данные заказа."
        ),
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

    const nextOrderSnapshot = {
      id: quickDateDialog.orderId,
      client_order: currentOrder?.client_order || "",
      supplier_id: currentOrder?.supplier_id || null,
      order_items: (currentOrder?.order_items || []).map((row) =>
        row.id === quickDateDialog.itemId
          ? {
              ...row,
              status: "Поставлен",
              delivered_date: dateValue,
              canceled_date: null,
            }
          : row
      ),
    };

    await notifyOrderChanged({
      beforeOrder: currentOrder as OrderWithItems,
      afterOrder: nextOrderSnapshot,
      updatedAtKey: nowTimestamp,
    }).catch(() => {});

    closeQuickDateDialog();
    showToast("Статус обновлён", { variant: "success" });
  };

  const updateItemStatusQuick = async (
    orderId: number,
    item: OrderItem,
    newStatus: string
  ) => {
    if (!user) return;

    const currentOrder = orders.find((x) => x.id === orderId);

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
        description: getFriendlyErrorMessage(
          error,
          "Не удалось обновить статус позиции."
        ),
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
        description: getFriendlyErrorMessage(
          orderError,
          "Не удалось обновить служебные данные заказа."
        ),
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

    const nextOrderSnapshot = {
      id: orderId,
      client_order: currentOrder?.client_order || "",
      supplier_id: currentOrder?.supplier_id || null,
      order_items: (currentOrder?.order_items || []).map((row) =>
        row.id === item.id
          ? {
              ...row,
              status: newStatus,
              delivered_date: null,
              canceled_date: newStatus === "Отменен" ? today : null,
            }
          : row
      ),
    };

    await notifyOrderChanged({
      beforeOrder: currentOrder as OrderWithItems,
      afterOrder: nextOrderSnapshot,
      updatedAtKey: nowTimestamp,
    }).catch(() => {});

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

      {photoGuideOpen ? (
        <div className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-[2px]">
          <div className="flex min-h-screen items-end justify-center p-0 md:items-center md:p-4">
            <div className="premium-shell w-full rounded-t-[24px] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:max-w-lg md:rounded-[30px] md:p-6">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                Фото документа
              </div>
              <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[28px]">
                Как снять лучше
              </h3>
              <div className="mt-4 space-y-2.5 text-[13px] leading-5 text-slate-600 md:text-sm md:leading-6">
                <div>Держи телефон ровно и снимай сверху, без сильного угла.</div>
                <div>Старайся, чтобы весь список попал в кадр и был при хорошем свете.</div>
                <div>После снимка ты ещё увидишь предпросмотр и сможешь переснять.</div>
              </div>
              <div className="mt-5 flex flex-col gap-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setPhotoGuideOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={openPhotoPicker}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Продолжить
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {photoPreviewOpen && pendingPhotoPreviewUrl ? (
        <div className="fixed inset-0 z-[91] bg-slate-950/55 backdrop-blur-[2px]">
          <div className="flex min-h-screen items-end justify-center p-0 md:items-center md:p-4">
            <div className="premium-shell flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-[24px] shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:h-auto md:max-h-[92vh] md:max-w-2xl md:rounded-[30px]">
              <div className="shrink-0 border-b border-slate-100 px-4 py-3 md:px-6 md:py-5">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Предпросмотр
                </div>
                <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[28px]">
                  Проверь фото перед распознаванием
                </h3>
                <p className="mt-1.5 text-[12px] text-slate-500 md:text-sm">
                  Если текст читается плохо или кадр под углом, лучше переснять.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-2">
                  <img
                    src={pendingPhotoPreviewUrl}
                    alt="Предпросмотр фото документа"
                    className="max-h-[58vh] w-full rounded-[18px] object-contain bg-white"
                  />
                </div>

                <div className="mt-4 rounded-[20px] border border-stone-200 bg-stone-50/80 px-4 py-3 text-[12px] leading-5 text-stone-700 md:text-sm md:leading-6">
                  Хороший кадр: текст ровный, без сильных теней, список почти горизонтален.
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 md:px-6 md:py-4">
                <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      closePhotoPreview();
                      window.setTimeout(() => photoInputRef.current?.click(), 120);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Переснять
                  </button>
                  <button
                    type="button"
                    onClick={confirmPhotoPreview}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Использовать фото
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <QuickDateDialog
        dialog={quickDateDialog}
        setDialog={setQuickDateDialog}
        closeDialog={closeQuickDateDialog}
        confirmDialog={confirmQuickDateDialog}
      />

      <div className="min-h-screen bg-[#F3F5F7] p-2 md:p-6">
        <div className="bottom-nav-safe mx-auto max-w-7xl space-y-3 md:space-y-5 md:pb-0">
          <div className="premium-enter overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:rounded-[24px]">
            <div className="hero-premium relative px-4 py-3 text-white md:px-6 md:py-5">
              <div className="relative flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="shrink-0 pt-0.5">
                      <AppLogo compact showText={false} />
                    </div>

                    <div className="min-w-0">
                      <div className="glass-chip inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-medium text-slate-300 md:px-3 md:text-[11px]">
                        Центр управления заказами
                      </div>

                      <h1 className="premium-ui-title mt-2 text-[22px] text-white md:text-[31px] md:leading-[1.04]">
                        Общая таблица заказов
                      </h1>

                      <p className="premium-subtitle mt-1 max-w-3xl text-[13px] leading-5 text-slate-300 md:text-[15px] md:leading-6">
                        Система обработки и мониторинга заказов Автодом – Союз.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col gap-2 lg:min-w-[300px] lg:items-end">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                    <div className="glass-chip rounded-[14px] px-3 py-1.5 text-[12px] text-white md:rounded-[14px] md:px-3.5 md:py-2 md:text-[13px]">
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
                      className="glass-chip rounded-[14px] px-3 py-1.5 text-[12px] font-medium text-slate-100 transition hover:bg-white/10 md:rounded-[14px] md:px-3.5 md:py-2 md:text-[13px]"
                    >
                      Выйти
                    </button>
                  </div>

                  {user.role === "admin" || user.role === "buyer" ? (
                    <button
                      onClick={handleOpenCreateWithHaptic}
                      className="w-full rounded-[14px] bg-white px-4 py-2 text-[12px] font-semibold text-slate-900 shadow-none transition hover:bg-slate-100 lg:w-auto md:rounded-[14px] md:px-4 md:py-2.5 md:text-[13px]"
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
          ) : filteredOrders.length === 0 ? (
            <>
              {user.role !== "viewer" ? (
                <div className="premium-enter premium-enter-delay-1 md:hidden">
                  <NotificationPrompt
                    supported={notifications.supported}
                    permission={notifications.permission}
                    requesting={notifications.requesting}
                    pushReady={notifications.pushReady}
                    isIos={notifications.isIos}
                    isStandalone={notifications.isStandalone}
                    onEnable={notifications.requestPermission}
                  />
                </div>
              ) : null}
              <div className="premium-enter premium-enter-delay-1">
                <OrdersToolbar
                  stats={stats}
                  search={search}
                  setSearch={setSearch}
                  orderTypeFilter={orderTypeFilter}
                  setOrderTypeFilter={setOrderTypeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  supplierTabs={user.role === "supplier" ? [] : supplierTabs}
                  supplierTab={supplierTab}
                  setSupplierTab={setSupplierTab}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  setSortField={setSortField}
                  setSortDirection={setSortDirection}
                />
              </div>
              <div className="premium-enter premium-enter-delay-2">
                <EmptyStateCard
                  title="Сейчас здесь чисто"
                  description="Мы не нашли заказов по текущим параметрам. Попробуй убрать часть фильтров или ввести другой запрос."
                />
              </div>
            </>
          ) : (
            <>
              {user.role !== "viewer" ? (
                <div className="premium-enter premium-enter-delay-1 md:hidden">
                  <NotificationPrompt
                    supported={notifications.supported}
                    permission={notifications.permission}
                    requesting={notifications.requesting}
                    pushReady={notifications.pushReady}
                    isIos={notifications.isIos}
                    isStandalone={notifications.isStandalone}
                    onEnable={notifications.requestPermission}
                  />
                </div>
              ) : null}

              <div className="premium-enter premium-enter-delay-1">
                <OrdersToolbar
                  stats={stats}
                  search={search}
                  setSearch={setSearch}
                  orderTypeFilter={orderTypeFilter}
                  setOrderTypeFilter={setOrderTypeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  supplierTabs={user.role === "supplier" ? [] : supplierTabs}
                  supplierTab={supplierTab}
                  setSupplierTab={setSupplierTab}
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
                  search={search}
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
                  search={search}
                  user={user}
                  toggleOrderExpand={toggleOrderExpand}
                  removeOrder={removeOrder}
                  updateItemStatusQuick={updateItemStatusQuick}
                  copyArticle={copyArticle}
                />
              </div>
            </>
          )}

          {!loading && orders.length > 0 ? (
            <OrdersAttentionWidget
              open={showAttentionPanel}
              hasAttentionItems={hasAttentionItems}
              cards={attention.cards}
              topAttentionOrders={attention.topAttentionOrders}
              onToggle={() => setShowAttentionPanel((prev) => !prev)}
              onApplyFocus={applyFocusFilter}
            />
          ) : null}

          <CreateOrderMethodDialog
            open={createMethodOpen}
            onClose={() => setCreateMethodOpen(false)}
            onSelect={handleSelectCreateMethod}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelUpload}
            className="hidden"
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />

          {!open && (photoParsing || excelImporting) ? (
            <div className="fixed inset-0 z-[96] bg-slate-950/45 backdrop-blur-[2px]">
              <div className="flex min-h-screen items-center justify-center p-4">
                <div className="premium-shell flex w-full max-w-sm flex-col items-center gap-3 rounded-[28px] px-6 py-7 text-center shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                  <div className="premium-title text-[18px] font-semibold tracking-tight text-slate-900">
                    {photoParsing ? "Распознаём фото" : "Подгружаем Excel"}
                  </div>
                  <div className="text-sm leading-6 text-slate-500">
                    Подготовим позиции и сразу откроем форму уже с готовыми данными.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <OrderFormModal
            open={open}
            saving={saving}
            photoParsing={photoParsing}
            importReview={currentImportReview}
            editingOrderId={editingOrderId}
            userRole={user.role}
            suppliers={suppliers}
            form={form}
            parsedComments={parsedComments}
            canEditOrderTextFields={canEditOrderTextFields(user)}
            canEditItemMainFields={canEditItemMainFields(user)}
            canEditItemStatusFields={canEditItemStatusFields(user)}
            canEditItemPlannedDate={canEditItemPlannedDate(user)}
            canComment={canComment(user)}
            canUseBulkActions={canUseBulkActions(user)}
            canUseBulkStatusActions={canUseBulkStatusActions(user)}
            canUseBulkPlannedDateActions={canUseBulkPlannedDateActions(user)}
            canEditOrderDate={canEditOrderDate(user)}
            onRequestClose={requestCloseModal}
            setForm={setForm}
            applyBulkPlannedDate={applyBulkPlannedDate}
            applyBulkStatus={applyBulkStatus}
            addItemRow={addItemRow}
            duplicateItemRow={duplicateItemRow}
            clearItemRow={clearItemRow}
            keepOnlyProblemItems={keepOnlyProblemItems}
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
                onClick: handleOpenCreateWithHaptic,
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
