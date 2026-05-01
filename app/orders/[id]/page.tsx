"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FieldBlock, InfoRow, StatMini } from "../../../components/orders/details/OrderDetailPrimitives";
import { OrderDetailSkeleton } from "../../../components/orders/LoadingSkeletons";
import { LoginForm } from "../../../components/orders/LoginForm";
import { AppDialog } from "../../../components/ui/AppDialog";
import { MobileBottomNav } from "../../../components/ui/MobileBottomNav";
import { MobileLaunchReveal } from "../../../components/ui/MobileLaunchReveal";
import { PremiumIconTile } from "../../../components/ui/PremiumIconTile";
import { ToastViewport } from "../../../components/ui/ToastViewport";
import { AppLogo } from "../../../components/ui/AppLogo";
import { EmptyStateCard } from "../../../components/ui/EmptyStateCard";
import { useOrdersAuthActions } from "../../../lib/auth/useOrdersAuthActions";
import { useProfileAuth } from "../../../lib/auth/useProfileAuth";
import { fetchOrderById } from "../../../lib/orders/api";
import { fetchSuppliers, mapSuppliers } from "../../../lib/suppliers/api";
import { EMPTY_ITEM, ORDER_TYPE_OPTIONS, STATUS_OPTIONS } from "../../../lib/orders/constants";
import { mapFormItemsToOrderItems, mapOrderToFormState } from "../../../lib/orders/detail";
import {
  canComment,
  canEditItemMainFields,
  canEditItemPlannedDate,
  canEditItemStatusFields as canEditItemStatusFieldsByRole,
  canEditOrderTextFields as canEditOrderTextFieldsByRole,
  canUseBulkActions,
  canUseBulkPlannedDateActions,
  canUseBulkStatusActions,
} from "../../../lib/orders/permissions";
import { useOrderDetailActions } from "../../../lib/orders/useOrderDetailActions";
import type {
  ItemForm,
  OrderItem,
  OrderFormState,
  OrderWithItems,
  SupplierSummary,
} from "../../../lib/orders/types";
import { useDialog } from "../../../lib/ui/useDialog";
import { triggerHapticFeedback } from "../../../lib/ui/haptics";
import { feedback } from "@/src/lib/feedback";
import {
  getFriendlyErrorMessage,
  isOffline,
  normalizeToastOptions,
  useConnectionFeedback,
} from "../../../lib/ui/network";
import { useToast } from "../../../lib/ui/useToast";
import {
  formatDate,
  formatDateTimeForView,
  getOrderDeliveredDate,
  getOrderPlannedDate,
  getOrderProgress,
  getOrderStatus,
  getTodayDate,
  hasComment,
  hasReplacementInOrder,
  isItemCurrentlyOverdue,
  isItemOverdue,
  normalizeDateForCompare,
  orderTypeClasses,
  parseComments,
  statusClasses,
  statusSelectClasses,
} from "../../../lib/orders/utils";

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = Number(params?.id);
  const highlightQuery = (searchParams.get("highlight") || "").trim().toLowerCase();

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [itemViewFilter, setItemViewFilter] = useState<
    "all" | "changed" | "overdue" | "replacement"
  >("all");
  const [itemSearch, setItemSearch] = useState("");
  const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);

  const { user, setUser, authLoading, profileLoading, setProfileLoading } =
    useProfileAuth();

  const [form, setForm] = useState<OrderFormState>({
    clientOrder: "",
    orderDate: "",
    orderType: "Стандартный",
    supplierId: "",
    comment: "",
    newComment: "",
    bulkPlannedDate: "",
    bulkStatus: "Новый",
    items: [{ ...EMPTY_ITEM }],
  });

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
  const initialFormSnapshot = useMemo(
    () => (order ? serializeOrderForm(mapOrderToFormState(order, EMPTY_ITEM)) : ""),
    [order, serializeOrderForm]
  );
  const initialFormState = useMemo(
    () => (order ? mapOrderToFormState(order, EMPTY_ITEM) : null),
    [order]
  );
  const isFormDirty =
    !!order && initialFormSnapshot !== "" && serializeOrderForm(form) !== initialFormSnapshot;

  useConnectionFeedback(showToast);
  const isHighlightedArticle = useCallback(
    (value: string) => {
      const normalizedValue = value.trim().toLowerCase();
      return Boolean(highlightQuery && normalizedValue && normalizedValue.includes(highlightQuery));
    },
    [highlightQuery]
  );

  const canEditOrderTextFields = canEditOrderTextFieldsByRole(user);
  const canEditSupplierAssignment = user?.role === "admin" || user?.role === "buyer";
  const canEditMainItemFields = canEditItemMainFields(user);
  const canEditItemStatusFields = canEditItemStatusFieldsByRole(user);
  const canBulkEditItems = canUseBulkActions(user);
  const canBulkStatusItems = canUseBulkStatusActions(user);
  const canBulkPlannedDateItems = canUseBulkPlannedDateActions(user);
  const canCommentOnOrder = canComment(user);
  const isAdmin = user?.role === "admin";

  const viewItems: OrderItem[] = useMemo(
    () => mapFormItemsToOrderItems(form.items, orderId || 0),
    [form.items, orderId]
  );

  const orderStatus = getOrderStatus(viewItems);
  const progress = getOrderProgress(viewItems);
  const plannedDate = getOrderPlannedDate(viewItems);
  const fullDeliveredDate = getOrderDeliveredDate(viewItems);
  const changedItemsCount = useMemo(() => {
    if (!initialFormState) return 0;

    return form.items.filter((item, index) => {
      const original = initialFormState.items[index];
      if (!original) return true;

      return (
        item.article !== original.article ||
        item.name !== original.name ||
        item.quantity !== original.quantity ||
        item.plannedDate !== original.plannedDate ||
        item.status !== original.status ||
        item.hasReplacement !== original.hasReplacement ||
        item.replacementArticle !== original.replacementArticle ||
        item.deliveredDate !== original.deliveredDate ||
        item.canceledDate !== original.canceledDate
      );
    }).length;
  }, [form.items, initialFormState]);

  const getChangedFields = useCallback(
    (item: ItemForm, index: number) => {
      const original = initialFormState?.items[index];

      if (!original) {
        return {
          article: true,
          name: true,
          quantity: true,
          plannedDate: true,
          status: true,
          hasReplacement: true,
          replacementArticle: !!item.replacementArticle || item.hasReplacement,
          deliveredDate: !!item.deliveredDate,
          canceledDate: !!item.canceledDate,
          any: true,
        };
      }

      const changes = {
        article: item.article !== original.article,
        name: item.name !== original.name,
        quantity: item.quantity !== original.quantity,
        plannedDate: item.plannedDate !== original.plannedDate,
        status: item.status !== original.status,
        hasReplacement: item.hasReplacement !== original.hasReplacement,
        replacementArticle: item.replacementArticle !== original.replacementArticle,
        deliveredDate: item.deliveredDate !== original.deliveredDate,
        canceledDate: item.canceledDate !== original.canceledDate,
      };

      return {
        ...changes,
        any: Object.values(changes).some(Boolean),
      };
    },
    [initialFormState]
  );

  const itemRows = useMemo(() => {
    const normalizedSearch = itemSearch.trim().toLowerCase();

    return form.items
      .map((item, index) => {
        const changedFields = getChangedFields(item, index);
        const itemOverdue = isItemOverdue({
          id: item.id || -(index + 1),
          order_id: order?.id || orderId || 0,
          article: item.article || null,
          replacement_article: item.hasReplacement ? item.replacementArticle || null : null,
          name: item.name || null,
          quantity: item.quantity || null,
          planned_date: item.plannedDate || null,
          status: item.status || "Новый",
          delivered_date: item.deliveredDate || null,
          canceled_date: item.canceledDate || null,
        });

        const searchable = [item.article, item.name, item.replacementArticle]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
        const matchesFilter =
          itemViewFilter === "all"
            ? true
            : itemViewFilter === "changed"
            ? changedFields.any
            : itemViewFilter === "overdue"
            ? itemOverdue
            : item.hasReplacement;

        return {
          item,
          index,
          changedFields,
          itemOverdue,
          visible: matchesSearch && matchesFilter,
        };
      })
      .filter((row) => row.visible);
  }, [form.items, getChangedFields, itemSearch, itemViewFilter, order?.id, orderId]);

  const itemViewStats = useMemo(
    () => ({
      all: form.items.length,
      changed: changedItemsCount,
      overdue: form.items.filter((item, index) =>
        isItemOverdue({
          id: item.id || -(index + 1),
          order_id: order?.id || orderId || 0,
          article: item.article || null,
          replacement_article: item.hasReplacement ? item.replacementArticle || null : null,
          name: item.name || null,
          quantity: item.quantity || null,
          planned_date: item.plannedDate || null,
          status: item.status || "Новый",
          delivered_date: item.deliveredDate || null,
          canceled_date: item.canceledDate || null,
        })
      ).length,
      replacement: form.items.filter((item) => item.hasReplacement).length,
    }),
    [changedItemsCount, form.items, order?.id, orderId]
  );

  const loadOrder = useCallback(async () => {
    if (!orderId || Number.isNaN(orderId)) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await fetchOrderById(orderId, user);

    if (error) {
      console.error("Ошибка загрузки заказа:", error);
      showToast("Ошибка загрузки заказа", {
        description: getFriendlyErrorMessage(
          error,
          "Не удалось загрузить карточку заказа."
        ),
        variant: "error",
      });
      setLoading(false);
      return;
    }

    const loadedOrder = (data as OrderWithItems) || null;
    setOrder(loadedOrder);

    if (loadedOrder) {
      setForm(mapOrderToFormState(loadedOrder, EMPTY_ITEM));
    }

    setLoading(false);
  }, [orderId, showToast, user]);

  useEffect(() => {
    if (user) {
      void loadOrder();
    } else {
      setOrder(null);
      setLoading(false);
    }
  }, [user, loadOrder]);

  useEffect(() => {
    if (!user || user.role === "viewer" || user.role === "supplier") {
      setSuppliers([]);
      return;
    }

    void (async () => {
      const { data, error } = await fetchSuppliers();
      if (error) {
        console.error("Ошибка загрузки поставщиков:", error);
        return;
      }
      setSuppliers(mapSuppliers(data as SupplierSummary[]));
    })();
  }, [user]);

  useEffect(() => {
    if (!isFormDirty || saving) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isFormDirty, saving]);

  const { login, logout } = useOrdersAuthActions({
    loginForm,
    setLoginError,
    setProfileLoading,
    setUser,
    setLoginForm,
    currentUser: user,
    showToast,
  });

  const getAvailableStatuses = (_currentStatus: string) => {
    return STATUS_OPTIONS;
  };

  const {
    updateItemField,
    applyBulkPlannedDate,
    applyBulkStatus,
    saveOrder,
    removeOrder,
  } = useOrderDetailActions({
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
    routerPush: router.push,
    onStatusVisualFeedback: (itemId) => {
      setHighlightedItemId(itemId);
      window.setTimeout(() => {
        setHighlightedItemId((current) => (current === itemId ? null : current));
      }, 760);
    },
  });

  const handleLogoutWithHaptic = () => {
    triggerHapticFeedback("light");
    void logout();
  };

  const handleSaveOrder = () => {
    if (isOffline()) {
      feedback("error");
      showToast("Нет соединения", {
        description: "Сейчас интернет недоступен. Сохранить изменения не получится.",
        variant: "error",
      });
      return;
    }

    void saveOrder();
  };

  const handleSaveOrderWithHaptic = () => {
    feedback("tap");
    handleSaveOrder();
  };

  const handleRemoveOrder = () => {
    void removeOrder();
  };

  const handleRemoveOrderWithHaptic = () => {
    triggerHapticFeedback("warning");
    void removeOrder();
  };

  const handleReloadOrder = () => {
    void loadOrder();
  };

  const handleBackNavigation = useCallback(
    async (event?: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isFormDirty || saving) {
        router.push("/");
        return;
      }

      event?.preventDefault();

      const confirmed = await requestConfirmation({
        title: "Выйти без сохранения?",
        description:
          "Есть несохранённые изменения. Если вернуться к списку сейчас, они потеряются.",
        confirmText: "Выйти без сохранения",
        variant: "danger",
      });

      if (!confirmed) return;

      router.push("/");
    },
    [isFormDirty, requestConfirmation, router, saving]
  );

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
        loading={removing}
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

      <div className="min-h-screen bg-slate-100/80 p-2 md:p-8 text-slate-900 antialiased">
        <div className="route-stage bottom-nav-safe mx-auto max-w-7xl space-y-4 md:space-y-6 md:pb-0">
          <div className="premium-enter overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.08)] md:rounded-[28px]">
            <div className="hero-premium relative px-3.5 py-3.5 text-white md:px-8 md:py-7">
              <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_top_right,rgba(180,138,76,0.18),transparent_55%)] pointer-events-none" />
              <div className="pointer-events-none absolute -left-8 top-8 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
              <div className="pointer-events-none absolute bottom-0 right-6 h-28 w-28 rounded-full bg-amber-300/10 blur-3xl" />

              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-4 md:gap-6">
                    <div className="shrink-0 pt-1">
                      <AppLogo compact showText={false} />
                    </div>

                    <div className="min-w-0">
                      <div className="glass-chip inline-flex items-center gap-2 rounded-full px-2 py-1 text-[8px] font-medium tracking-[0.08em] text-slate-200 md:px-3 md:text-[11px]">
                        Карточка заказа
                      </div>

                      <h1 className="mt-2 text-[19px] font-medium tracking-tight text-white md:mt-2.5 md:text-[44px] md:leading-[1.04]">
                        {form.clientOrder || "Заказ"}
                      </h1>

                      <p className="mt-1.5 max-w-3xl text-[12px] leading-[1.1rem] text-slate-300 md:mt-3 md:text-base md:leading-6">
                        Полноценная страница редактирования заказа и его позиций.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col gap-2.5 lg:min-w-[340px] lg:items-end">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                    <div className="glass-chip rounded-[18px] px-2.5 py-1.5 text-[12px] text-white md:rounded-2xl md:px-4 md:py-2.5 md:text-sm">
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
                      className="glass-chip rounded-[18px] px-2.5 py-1.5 text-[12px] font-medium text-slate-100 transition hover:bg-white/10 md:rounded-2xl md:px-4 md:py-2.5 md:text-sm"
                    >
                      Выйти
                    </button>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <Link
                      href="/"
                      onClick={handleBackNavigation}
                      className="route-link glass-chip rounded-[18px] px-3.5 py-2 text-center text-[12px] font-medium text-white transition hover:bg-white/15 md:rounded-2xl md:px-5 md:py-3 md:text-sm"
                    >
                      Назад к списку
                    </Link>

                    {user.role === "admin" ? (
                      <button
                        onClick={handleRemoveOrderWithHaptic}
                        className="glass-chip rounded-[18px] px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-white/15 md:rounded-2xl md:px-5 md:py-3 md:text-sm"
                      >
                        Удалить заказ
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="premium-enter premium-enter-delay-1">
              <OrderDetailSkeleton />
            </div>
          ) : !order ? (
            <EmptyStateCard
              title="Заказ не найден"
              description="Похоже, запись была удалена или ссылка устарела. Вернись к общему списку и открой нужный заказ заново."
            />
          ) : (
            <>
              <div className="premium-enter premium-enter-delay-1 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <StatMini
                  title="Статус"
                  value={orderStatus}
                  badgeClass={statusClasses(orderStatus)}
                />
                <StatMini
                  title="Тип"
                  value={form.orderType || "Стандартный"}
                  badgeClass={orderTypeClasses(form.orderType || "Стандартный")}
                />
                <StatMini title="Плановая" value={formatDate(plannedDate)} />
                <StatMini title="Полная поставка" value={formatDate(fullDeliveredDate)} />
              </div>

              <div className="premium-enter premium-enter-delay-2 grid gap-4 md:gap-5 xl:grid-cols-[1.72fr_0.82fr]">
                <div className="space-y-4 md:space-y-5">
                  <section className="premium-shell rounded-[22px] p-4 md:rounded-[28px] md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <PremiumIconTile
                          tone="sky"
                          icon={
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M4 7H20" />
                              <path d="M7 4V10" />
                              <path d="M17 4V10" />
                              <rect x="4" y="6" width="16" height="14" rx="3" />
                            </svg>
                          }
                        />
                        <div>
                          <div className="premium-kicker text-[10px] text-slate-400 md:text-[11px]">
                            Основная информация
                          </div>
                          <h2 className="premium-ui-title mt-1.5 text-[18px] text-slate-900 md:mt-2 md:text-[24px]">
                            Параметры заказа
                          </h2>
                        </div>
                      </div>

                      <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 md:px-3 md:text-[11px]">
                        ID: {order.id}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:mt-5 md:gap-4 md:grid-cols-4">
                      <FieldBlock label="Номер клиентского заказа">
                        <input
                          value={form.clientOrder}
                          disabled={!canEditOrderTextFields || saving}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, clientOrder: e.target.value }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </FieldBlock>

                      <FieldBlock label="Дата заказа">
                        <input
                          type="date"
                          value={form.orderDate}
                          disabled={!canEditOrderTextFields || saving}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, orderDate: e.target.value }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </FieldBlock>

                      <FieldBlock label="Тип заказа">
                        <select
                          value={form.orderType}
                          disabled
                          className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-sm text-slate-500 outline-none"
                        >
                          {ORDER_TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </FieldBlock>

                      <FieldBlock label="Поставщик">
                        {canEditSupplierAssignment ? (
                          <select
                            value={form.supplierId}
                            disabled={!canEditSupplierAssignment || saving}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, supplierId: e.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            <option value="">Выбери поставщика</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-sm text-slate-500">
                            {order.supplier?.name || "Не назначен"}
                          </div>
                        )}
                      </FieldBlock>

                    </div>
                  </section>

                  {canBulkEditItems ? (
                    <section className="premium-shell rounded-[26px] p-4 md:rounded-[28px] md:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <PremiumIconTile
                            tone="amber"
                            icon={
                              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M12 3V21" />
                                <path d="M3 12H21" />
                              </svg>
                            }
                          />
                          <div>
                          <div className="premium-kicker text-[10px] text-slate-400 md:text-[11px]">
                            Массовые действия
                          </div>
                            <h2 className="premium-ui-title mt-2 text-[24px] text-slate-900">
                              Быстрое применение
                            </h2>
                          </div>
                        </div>

                        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                          Для всех позиций
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3.5">
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-3.5 md:p-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[260px_auto] md:items-end">
                            <FieldBlock label="Плановая дата для всех позиций" compact>
                              <input
                                type="date"
                                min={isAdmin ? undefined : getTodayDate()}
                                value={form.bulkPlannedDate}
                                disabled={!canBulkPlannedDateItems || saving}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    bulkPlannedDate: e.target.value,
                                  }))
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                              />
                            </FieldBlock>

                            <button
                              onClick={applyBulkPlannedDate}
                              disabled={!canBulkPlannedDateItems || saving}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                            >
                              Применить дату ко всем
                            </button>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-3.5 md:p-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[260px_auto] md:items-end">
                            <FieldBlock label="Статус для всех позиций" compact>
                              <select
                                value={form.bulkStatus}
                                disabled={!canBulkStatusItems || saving}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    bulkStatus: e.target.value,
                                  }))
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                              >
                                {STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </FieldBlock>

                            <button
                              onClick={applyBulkStatus}
                              disabled={!canBulkStatusItems || saving}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                            >
                              Применить статус ко всем
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <section className="premium-shell rounded-[26px] p-4 md:rounded-[28px] md:p-5">
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <PremiumIconTile
                          tone="violet"
                          icon={
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M5 6H19" />
                              <path d="M5 12H19" />
                              <path d="M5 18H14" />
                            </svg>
                          }
                        />
                        <div>
                          <div className="premium-kicker text-[10px] text-slate-400 md:text-[11px]">
                            Позиции
                          </div>
                          <h2 className="premium-ui-title mt-2 text-[24px] text-slate-900">
                            Состав заказа
                          </h2>
                        </div>
                      </div>

                      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                        {form.items.length} шт.
                      </div>
                    </div>

                    <div className="mb-5 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                      <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-500">
                        <span>Прогресс исполнения</span>
                        <span className="text-slate-700">
                          {progress.delivered}/{progress.total}
                        </span>
                      </div>

                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="bg-emerald-500"
                          style={{
                            width:
                              progress.total > 0
                                ? `${(progress.delivered / progress.total) * 100}%`
                                : "0%",
                          }}
                        />
                        <div
                          className="bg-rose-500"
                          style={{
                            width:
                              progress.total > 0
                                ? `${(progress.canceled / progress.total) * 100}%`
                                : "0%",
                          }}
                        />
                        <div
                          className="bg-slate-300"
                          style={{
                            width:
                              progress.total > 0
                                ? `${(progress.active / progress.total) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>

                    {isFormDirty ? (
                      <div className="mb-5 rounded-[20px] border border-amber-200 bg-amber-50/85 px-4 py-3.5 text-sm text-amber-900">
                        <div className="font-medium">Есть несохранённые изменения</div>
                        <div className="mt-1 text-amber-800">
                          Изменено позиций: {changedItemsCount}. Перед уходом со страницы не забудь сохранить заказ.
                        </div>
                      </div>
                    ) : null}

                    <div className="mb-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-3.5 md:p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {[
                            ["all", "Все", itemViewStats.all],
                            ["changed", "Изменены", itemViewStats.changed],
                            ["overdue", "Просрочены", itemViewStats.overdue],
                            ["replacement", "С заменой", itemViewStats.replacement],
                          ].map(([key, label, count]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                setItemViewFilter(
                                  key as "all" | "changed" | "overdue" | "replacement"
                                )
                              }
                              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                                itemViewFilter === key
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                              }`}
                            >
                              {label} · {count}
                            </button>
                          ))}
                        </div>

                        <div className="w-full md:max-w-[280px]">
                          <input
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            placeholder="Поиск по позиции внутри заказа"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {itemRows.length === 0 ? (
                        <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                          По текущему фильтру и поиску позиции не найдены.
                        </div>
                      ) : (
                      itemRows.map(({ item, index, changedFields, itemOverdue }) => {
                        const persistedItem = item.id
                          ? (order?.order_items || []).find((existing) => existing.id === item.id) ||
                            null
                          : null;
                        const hasUnsavedSupplierPlannedDateChange =
                          user?.role === "supplier" &&
                          !!persistedItem &&
                          normalizeDateForCompare(item.plannedDate) !==
                            normalizeDateForCompare(persistedItem.planned_date);
                        const canEditPlannedDateForRow =
                          canEditItemPlannedDate(user, persistedItem || item) ||
                          hasUnsavedSupplierPlannedDateChange;
                        const showPlannedDateLockHint =
                          user?.role === "supplier" && !canEditPlannedDateForRow;

                        const eventLabel =
                          item.status === "Поставлен"
                            ? `Поставка: ${formatDate(item.deliveredDate || null)}`
                            : item.status === "Отменен"
                            ? `Отмена: ${formatDate(item.canceledDate || null)}`
                            : itemOverdue
                            ? "Просрочено"
                            : null;

                        return (
                          <div
                            key={item.id || `item-${index}`}
                            className={`premium-card-hover overflow-hidden rounded-[26px] border bg-white shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition ${
                              itemOverdue
                                ? "border-rose-200 ring-1 ring-rose-100"
                                : changedFields.any
                                ? "border-amber-200 ring-1 ring-amber-100"
                                : isHighlightedArticle(item.article) ||
                                  isHighlightedArticle(item.replacementArticle)
                                ? "border-amber-300 ring-2 ring-amber-100"
                                : "border-slate-200"
                            } ${highlightedItemId === item.id ? "feedback-row-highlight" : ""}`}
                          >
                            <div
                              className={`border-b px-4 py-3 md:px-5 ${
                                itemOverdue
                                  ? "border-rose-100 bg-rose-50/70"
                                  : "border-slate-100 bg-slate-50/80"
                              }`}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-white">
                                    Позиция {index + 1}
                                  </div>

                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium ${statusClasses(
                                      item.status || "Новый"
                                    )}`}
                                  >
                                    {item.status || "Новый"}
                                  </span>

                                  {item.deadlineBreachedAt ? (
                                    <div className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700">
                                      Срок нарушен
                                    </div>
                                  ) : null}

                                  {!item.deadlineBreachedAt && itemOverdue ? (
                                    <div className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700">
                                      Просрочено
                                    </div>
                                  ) : null}

                                  {item.hasReplacement ? (
                                    <div className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700">
                                      Есть замена
                                    </div>
                                  ) : null}

                                  {changedFields.any ? (
                                    <div className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700">
                                      Не сохранено
                                    </div>
                                  ) : null}
                                </div>

                                {eventLabel ? (
                                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                                    {eventLabel}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="p-4 md:p-5">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.3fr_1.45fr_0.5fr_0.95fr_1.12fr]">
                                <FieldBlock label="Артикул" compact>
                                  <input
                                    value={item.article}
                                    disabled={!canEditMainItemFields || saving}
                                    onChange={(e) =>
                                      updateItemField(index, "article", e.target.value)
                                    }
                                    className={`w-full rounded-2xl border px-4 py-3.5 font-mono text-[13px] text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 ${
                                      isHighlightedArticle(item.article)
                                        ? "border-amber-300 bg-amber-50/80 ring-2 ring-amber-100"
                                        : changedFields.article
                                        ? "border-blue-200 bg-blue-50/70"
                                        : "border-slate-200 bg-slate-50"
                                    }`}
                                  />
                                </FieldBlock>

                                <FieldBlock label="Наименование" compact>
                                  <input
                                    value={item.name}
                                    disabled={!canEditMainItemFields || saving}
                                    onChange={(e) =>
                                      updateItemField(index, "name", e.target.value)
                                    }
                                    className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 ${
                                      changedFields.name
                                        ? "border-blue-200 bg-blue-50/70"
                                        : "border-slate-200 bg-slate-50"
                                    }`}
                                  />
                                </FieldBlock>

                                <FieldBlock label="Кол-во" compact>
                                  <input
                                    value={item.quantity}
                                    disabled={!canEditMainItemFields || saving}
                                    onChange={(e) =>
                                      updateItemField(index, "quantity", e.target.value)
                                    }
                                    className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 ${
                                      changedFields.quantity
                                        ? "border-blue-200 bg-blue-50/70"
                                        : "border-slate-200 bg-slate-50"
                                    }`}
                                  />
                                </FieldBlock>

                                <FieldBlock label={item.deadlineBreachedAt ? "Новый срок" : "Плановая"} compact>
                                  <div className="space-y-2">
                                    <div className="group relative">
                                      <input
                                        type="date"
                                        min={isAdmin ? undefined : getTodayDate()}
                                        value={item.plannedDate}
                                        disabled={!canEditPlannedDateForRow || saving}
                                        onChange={(e) =>
                                          updateItemField(index, "plannedDate", e.target.value)
                                        }
                                        className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 ${
                                          changedFields.plannedDate
                                            ? "border-blue-200 bg-blue-50/70"
                                            : "border-slate-200 bg-slate-50"
                                        }`}
                                      />

                                      {showPlannedDateLockHint ? (
                                        <div className="pointer-events-none absolute left-0 top-full z-20 hidden w-64 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.12)] group-hover:block group-focus-within:block">
                                          Поставщик может переносить срок только после фактической
                                          просрочки позиции.
                                        </div>
                                      ) : null}
                                    </div>

                                    {item.initialPlannedDate &&
                                    (item.initialPlannedDate !== item.plannedDate || item.deadlineBreachedAt) ? (
                                      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] leading-5 text-amber-900">
                                        <div>
                                          Первая дата:{" "}
                                          <span className="font-semibold">
                                            {formatDate(item.initialPlannedDate || null)}
                                          </span>
                                        </div>
                                        <div className="mt-0.5 text-amber-800">
                                          Новый срок: {formatDate(item.plannedDate || null)}
                                        </div>
                                        {item.deadlineBreachedAt ? (
                                          <div className="mt-0.5 text-amber-800">
                                            Первый срок уже нарушен и не снимается из аналитики.
                                          </div>
                                        ) : null}
                                        {(item.plannedDateChangeCount || 0) > 0 ? (
                                          <div className="mt-0.5 text-amber-800">
                                            Переносов: {item.plannedDateChangeCount}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    {item.deadlineBreachedAt && isItemCurrentlyOverdue({
                                      id: item.id || 0,
                                      order_id: 0,
                                      article: item.article || null,
                                      replacement_article: item.replacementArticle || null,
                                      name: item.name || null,
                                      quantity: item.quantity || null,
                                      planned_date: item.plannedDate || null,
                                      initial_planned_date: item.initialPlannedDate || null,
                                      planned_date_change_count: item.plannedDateChangeCount || 0,
                                      planned_date_last_changed_at: item.plannedDateLastChangedAt || null,
                                      planned_date_last_changed_by: item.plannedDateLastChangedBy || null,
                                      deadline_breached_at: item.deadlineBreachedAt || null,
                                      status: item.status || "Новый",
                                      delivered_date: item.deliveredDate || null,
                                      canceled_date: item.canceledDate || null,
                                    }) ? (
                                      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-[12px] leading-5 text-rose-700">
                                        Новый срок тоже уже просрочен.
                                      </div>
                                    ) : null}

                                  </div>
                                </FieldBlock>

                                <FieldBlock label="Статус" compact>
                                  <select
                                    value={item.status}
                                    disabled={!canEditItemStatusFields || saving}
                                    onChange={(e) =>
                                      updateItemField(index, "status", e.target.value)
                                    }
                                    className={`w-full rounded-2xl border px-4 py-3.5 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-500 ${
                                      changedFields.status ? "ring-2 ring-blue-100" : ""
                                    } ${statusSelectClasses(item.status || "Новый")}`}
                                  >
                                    {getAvailableStatuses(item.status || "Новый").map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                </FieldBlock>
                              </div>

                              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[180px_1.55fr_280px] md:items-end">
                                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={item.hasReplacement}
                                    disabled={!canEditMainItemFields || saving}
                                    onChange={(e) =>
                                      updateItemField(index, "hasReplacement", e.target.checked)
                                    }
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                  Есть замена
                                </label>

                                <FieldBlock label="Актуальный артикул" compact>
                                  <input
                                    value={item.replacementArticle}
                                    disabled={
                                      !canEditMainItemFields ||
                                      !item.hasReplacement ||
                                      saving
                                    }
                                    onChange={(e) =>
                                      updateItemField(
                                        index,
                                        "replacementArticle",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Укажи актуальный артикул"
                                    className={`w-full rounded-2xl border px-4 py-3.5 font-mono text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 ${
                                      isHighlightedArticle(item.replacementArticle)
                                        ? "border-amber-300 bg-amber-50/80 ring-2 ring-amber-100"
                                        : changedFields.replacementArticle || changedFields.hasReplacement
                                        ? "border-blue-200 bg-blue-50/70"
                                        : "border-slate-200 bg-slate-50"
                                    }`}
                                  />
                                </FieldBlock>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <FieldBlock label="Поставка" compact>
                                    {item.status === "Поставлен" && canEditItemStatusFields ? (
                                      <input
                                        type="date"
                                        value={item.deliveredDate}
                                        disabled={saving}
                                        onChange={(e) =>
                                          updateItemField(
                                            index,
                                            "deliveredDate",
                                            e.target.value
                                          )
                                        }
                                        className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 ${
                                          changedFields.deliveredDate
                                            ? "border-blue-200 bg-blue-50/70"
                                            : "border-slate-200 bg-slate-50"
                                        }`}
                                      />
                                    ) : (
                                      <div
                                        className={`rounded-2xl border px-4 py-3.5 text-sm text-slate-700 ${
                                          changedFields.deliveredDate
                                            ? "border-blue-200 bg-blue-50/70"
                                            : "border-slate-200 bg-slate-50"
                                        }`}
                                      >
                                        {formatDate(item.deliveredDate || null)}
                                      </div>
                                    )}
                                  </FieldBlock>

                                  <FieldBlock label="Отмена" compact>
                                    <div
                                      className={`rounded-2xl border px-4 py-3.5 text-sm text-slate-700 ${
                                        changedFields.canceledDate
                                          ? "border-blue-200 bg-blue-50/70"
                                          : "border-slate-200 bg-slate-50"
                                      }`}
                                    >
                                      {formatDate(item.canceledDate || null)}
                                    </div>
                                  </FieldBlock>
                                </div>

                              </div>
                            </div>
                          </div>
                        );
                      }))}
                    </div>
                  </section>
                </div>

                <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
                  <section className="premium-shell rounded-[26px] p-4 md:rounded-[28px] md:p-5">
                    <div className="flex items-start gap-3">
                      <PremiumIconTile
                        tone="emerald"
                        icon={
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M5 12L10 17L19 7" />
                          </svg>
                        }
                      />
                      <div>
                        <div className="premium-kicker text-[10px] text-slate-400 md:text-[11px]">
                          Сводка
                        </div>
                        <h2 className="premium-ui-title mt-2 text-[24px] text-slate-900">
                          Ключевые данные
                        </h2>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3.5">
                      <InfoRow label="Дата заказа" value={formatDate(form.orderDate || null)} />
                      <InfoRow
                        label="Последнее изменение"
                        value={
                          order.updated_at
                            ? `${order.updated_by || "—"} · ${formatDateTimeForView(
                                order.updated_at
                              )}`
                            : "—"
                        }
                      />

                      {hasComment(form.comment) ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-sm text-slate-700">
                          В заказе есть история комментариев.
                        </div>
                      ) : null}

                      {hasReplacementInOrder(viewItems) ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-700">
                          В заказе есть позиции с заменами.
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="premium-shell rounded-[26px] p-4 md:rounded-[28px] md:p-5">
                    <div className="flex items-start gap-3">
                      <PremiumIconTile
                        tone="slate"
                        icon={
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M8 10H16" />
                            <path d="M8 14H13" />
                            <rect x="4" y="5" width="16" height="14" rx="3" />
                          </svg>
                        }
                      />
                      <div>
                        <div className="premium-kicker text-[10px] text-slate-400 md:text-[11px]">
                          История
                        </div>
                        <h2 className="premium-ui-title mt-2 text-[24px] text-slate-900">
                          Комментарии и изменения
                        </h2>
                      </div>
                    </div>

                    <div className="mt-5 max-h-80 space-y-3 overflow-y-auto pr-1">
                      {parsedComments.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-sm text-slate-500">
                          Комментариев пока нет.
                        </div>
                      ) : (
                        parsedComments.map((entry, index) => (
                          <div
                            key={`${entry.datetime}-${entry.author}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-medium text-slate-800">
                                {entry.author}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {entry.datetime}
                              </div>
                            </div>
                            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {entry.text}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4">
                      <FieldBlock label="Новый комментарий">
                        <textarea
                          value={form.newComment}
                          disabled={!canCommentOnOrder || saving}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, newComment: e.target.value }))
                          }
                          className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </FieldBlock>
                    </div>
                  </section>

                  <section className="premium-shell rounded-[26px] p-4 md:rounded-[28px] md:p-5">
                    {isFormDirty ? (
                      <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/85 px-4 py-3 text-sm text-amber-900">
                        Несохранённых изменений: {changedItemsCount}
                      </div>
                    ) : (
                      <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        Все изменения сохранены
                      </div>
                    )}
                    <button
                      onClick={handleSaveOrderWithHaptic}
                      disabled={saving}
                      className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-sm font-medium text-white shadow-[0_20px_40px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Сохранение..." : "Сохранить изменения"}
                    </button>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <MobileBottomNav
        items={[
          {
            label: "Заказы",
            onClick: () => {
              void handleBackNavigation();
            },
            haptic: "light",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6H20" />
                <path d="M4 12H20" />
                <path d="M4 18H14" />
              </svg>
            ),
          },
          {
            label: "Сохранить",
            onClick: handleSaveOrder,
            active: true,
            tone: "accent",
            haptic: "success",
            disabled: loading || saving,
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 21H19" />
                <path d="M19 21V7L15 3H5V21" />
                <path d="M9 21V13H15V21" />
                <path d="M9 3V8H14" />
              </svg>
            ),
          },
          user?.role === "admin"
            ? {
                label: "Удалить",
                onClick: handleRemoveOrder,
                tone: "danger" as const,
                haptic: "warning" as const,
                disabled: loading || removing,
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6H21" />
                    <path d="M8 6V4H16V6" />
                    <path d="M19 6L18 20H6L5 6" />
                  </svg>
                ),
              }
            : {
                label: "Обновить",
                onClick: handleReloadOrder,
                haptic: "light" as const,
                disabled: loading,
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 12A8 8 0 1 1 17.5 6.2" />
                    <path d="M20 4V10H14" />
                  </svg>
                ),
              },
        ]}
      />
    </>
  );
}
