"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderWithItems } from "../orders/types";
import { getOrderStatus, isOrderOverdue } from "../orders/utils";

type ToastFn = (
  title: string,
  options?: {
    description?: string;
    variant?: "success" | "error" | "info";
  }
) => void;

const STORAGE_KEY_PREFIX = "avtodom-notification-snapshot-v3";
const SESSION_NOTIFICATIONS_KEY = "avtodom-session-notifications-v1";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function supportsServiceWorker() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

async function ensureServiceWorker() {
  if (!supportsServiceWorker()) return null;
  const registration = await navigator.serviceWorker.register("/sw.js");
  return registration;
}

async function showSystemNotification(title: string, body: string) {
  const icon = "/icon-192.png";

  try {
    const registration = await ensureServiceWorker();
    if (registration?.showNotification) {
      await registration.showNotification(title, {
        body,
        icon,
        badge: icon,
        tag: `avtodom-${title}`,
      });
      return;
    }
  } catch {}

  if (supportsNotifications() && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon,
    });
  }
}

function readSessionNotifications() {
  if (typeof window === "undefined") return [] as string[];

  try {
    const raw = window.sessionStorage.getItem(SESSION_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSessionNotifications(ids: string[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_NOTIFICATIONS_KEY, JSON.stringify(ids));
}

async function showSessionNotificationOnce(params: {
  id: string;
  title: string;
  body: string;
}) {
  const shown = readSessionNotifications();
  if (shown.includes(params.id)) return;

  await showSystemNotification(params.title, params.body);
  writeSessionNotifications([...shown, params.id]);
}

function getOrderLabel(order: OrderWithItems) {
  return (order.client_order || "").trim() || `Заказ #${order.id}`;
}

function formatOrderList(labels: string[]) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} и ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} и ещё ${labels.length - 2}`;
}

type UserRole = "admin" | "supplier" | "viewer" | "buyer";

type OrdersNotificationSnapshot = {
  total: number;
  overdue: string[];
  statuses: Record<
    string,
    {
      status: string;
      canceledCount: number;
      updatedAt: string;
    }
  >;
};

function readSnapshot(role: UserRole): OrdersNotificationSnapshot {
  if (typeof window === "undefined") {
    return {
      total: 0,
      overdue: [],
      statuses: {},
    };
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}-${role}`);
    if (!raw) {
      return {
        total: 0,
        overdue: [],
        statuses: {},
      };
    }
    const parsed = JSON.parse(raw) as Partial<OrdersNotificationSnapshot>;
    return {
      total: Number(parsed.total || 0),
      overdue: Array.isArray(parsed.overdue) ? parsed.overdue : [],
      statuses: parsed.statuses || {},
    };
  } catch {
    return {
      total: 0,
      overdue: [],
      statuses: {},
    };
  }
}

function writeSnapshot(role: UserRole, snapshot: OrdersNotificationSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_KEY_PREFIX}-${role}`, JSON.stringify(snapshot));
}

export function useOrdersNotifications(params: {
  orders: OrderWithItems[];
  userRole: UserRole;
  showToast: ToastFn;
}) {
  const { orders, userRole, showToast } = params;
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [requesting, setRequesting] = useState(false);

  const overdueIds = useMemo(
    () =>
      orders
        .filter((order) => isOrderOverdue(order.order_items || []))
        .map((order) => String(order.id)),
    [orders]
  );
  const statusesSnapshot = useMemo(
    () =>
      Object.fromEntries(
        orders.map((order) => [
          String(order.id),
          {
            status: getOrderStatus(order.order_items || []),
            canceledCount: (order.order_items || []).filter((item) => item.status === "Отменен")
              .length,
            updatedAt: order.updated_at || "",
          },
        ])
      ),
    [orders]
  );
  const ordersById = useMemo(
    () =>
      Object.fromEntries(
        orders.map((order) => [String(order.id), order])
      ) as Record<string, OrderWithItems>,
    [orders]
  );

  useEffect(() => {
    if (!supportsNotifications()) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
    void ensureServiceWorker();
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;
    if (userRole === "viewer") return;

    const previous = readSnapshot(userRole);
    const current = {
      total: orders.length,
      overdue: overdueIds,
      statuses: statusesSnapshot,
    };

    const tasks: Promise<void>[] = [];

    const newOrderCount = Object.keys(current.statuses).filter(
      (orderId) => !previous.statuses[orderId]
    ).length;
    const newlyOverdueIds = current.overdue.filter((id) => !previous.overdue.includes(id));
    const newlyOverdueCount = newlyOverdueIds.length;

    const changedStatusOrderIds: string[] = [];
    const cancellationOrderIds: string[] = [];

    for (const [orderId, snapshot] of Object.entries(current.statuses)) {
      const previousOrder = previous.statuses[orderId];
      if (!previousOrder) continue;

      if (snapshot.status !== previousOrder.status) {
        changedStatusOrderIds.push(orderId);
      }

      if (snapshot.canceledCount > previousOrder.canceledCount) {
        cancellationOrderIds.push(orderId);
      }
    }

    if (newOrderCount > 0 && ["admin", "supplier", "buyer"].includes(userRole)) {
      const labels = Object.keys(current.statuses)
        .filter((orderId) => !previous.statuses[orderId])
        .map((orderId) => ordersById[orderId])
        .filter(Boolean)
        .map(getOrderLabel)
        .slice(0, 3);

      tasks.push(
        showSessionNotificationOnce({
          id: `new-orders:${Object.keys(current.statuses)
            .filter((orderId) => !previous.statuses[orderId])
            .join(",")}`,
          title: "Новые заказы",
          body:
            labels.length > 0
              ? `Новые: ${formatOrderList(labels)}.`
              : newOrderCount === 1
              ? "Появился 1 новый заказ."
              : `Появилось новых заказов: ${newOrderCount}.`,
        })
      );
    }

    if (newlyOverdueCount > 0 && ["admin", "supplier", "buyer"].includes(userRole)) {
      const labels = newlyOverdueIds
        .map((orderId) => ordersById[orderId])
        .filter(Boolean)
        .map(getOrderLabel)
        .slice(0, 3);

      tasks.push(
        showSessionNotificationOnce({
          id: `overdue:${newlyOverdueIds.join(",")}`,
          title: "Просроченные заказы",
          body:
            labels.length > 0
              ? `Просрочены: ${formatOrderList(labels)}.`
              : newlyOverdueCount === 1
              ? "Появился 1 новый просроченный заказ."
              : `Появилось новых просроченных заказов: ${newlyOverdueCount}.`,
        })
      );
    }

    if (changedStatusOrderIds.length > 0 && ["admin", "buyer"].includes(userRole)) {
      const labels = changedStatusOrderIds
        .map((orderId) => ordersById[orderId])
        .filter(Boolean)
        .map(getOrderLabel)
        .slice(0, 3);

      tasks.push(
        showSessionNotificationOnce({
          id: `status-change:${changedStatusOrderIds.join(",")}:${changedStatusOrderIds
            .map((orderId) => current.statuses[orderId]?.status || "")
            .join(",")}`,
          title: "Изменение статусов",
          body:
            labels.length > 0
              ? `Изменились статусы: ${formatOrderList(labels)}.`
              : changedStatusOrderIds.length === 1
              ? "У одного заказа изменился статус."
              : `Изменились статусы заказов: ${changedStatusOrderIds.length}.`,
        })
      );
    }

    if (cancellationOrderIds.length > 0 && ["admin", "buyer"].includes(userRole)) {
      const labels = cancellationOrderIds
        .map((orderId) => ordersById[orderId])
        .filter(Boolean)
        .map(getOrderLabel)
        .slice(0, 3);

      tasks.push(
        showSessionNotificationOnce({
          id: `cancellations:${cancellationOrderIds.join(",")}:${cancellationOrderIds
            .map((orderId) => current.statuses[orderId]?.canceledCount || 0)
            .join(",")}`,
          title: "Есть отмены",
          body:
            labels.length > 0
              ? `Появились отмены: ${formatOrderList(labels)}.`
              : cancellationOrderIds.length === 1
              ? "Появилась 1 новая отменённая позиция."
              : `Появились отменённые позиции в заказах: ${cancellationOrderIds.length}.`,
        })
      );
    }

    writeSnapshot(userRole, current);
    void Promise.all(tasks);
  }, [
    orders.length,
    overdueIds,
    ordersById,
    permission,
    statusesSnapshot,
    userRole,
  ]);

  const requestPermission = useCallback(async () => {
    if (userRole === "viewer") {
      showToast("Уведомления недоступны", {
        description: "Для роли наблюдателя уведомления отключены.",
        variant: "info",
      });
      return;
    }

    if (!supportsNotifications()) {
      showToast("Уведомления недоступны", {
        description: "Этот браузер не поддерживает системные уведомления.",
        variant: "error",
      });
      return;
    }

    if (isIos() && !isStandaloneMode()) {
      showToast("Сначала установи приложение", {
        description:
          "На iPhone уведомления работают лучше после добавления сайта на экран домой.",
        variant: "info",
      });
    }

    setRequesting(true);

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission === "granted") {
        await ensureServiceWorker();
        showToast("Уведомления включены", {
          description: "Теперь приложение сможет сообщать о новых заказах, просрочках и изменениях.",
          variant: "success",
        });
      } else if (nextPermission === "denied") {
        showToast("Уведомления отключены", {
          description: "Разрешение не выдано. Его можно изменить в настройках браузера.",
          variant: "error",
        });
      }
    } catch (error) {
      showToast("Не удалось включить уведомления", {
        description:
          error instanceof Error ? error.message : "Браузер не дал включить уведомления.",
        variant: "error",
      });
    } finally {
      setRequesting(false);
    }
  }, [showToast]);

  return {
    supported: supportsNotifications(),
    permission,
    requesting,
    requestPermission,
    isStandalone: isStandaloneMode(),
    isIos: isIos(),
  };
}
