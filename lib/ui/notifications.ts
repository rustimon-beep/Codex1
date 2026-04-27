"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderWithItems } from "../orders/types";
import { getOrdersAttention } from "../orders/selectors";
import { getOrderStatus, isOrderOverdue } from "../orders/utils";

type ToastFn = (
  title: string,
  options?: {
    description?: string;
    variant?: "success" | "error" | "info";
  }
) => void;

const STORAGE_KEY_PREFIX = "avtodom-notification-snapshot-v2";

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

type UserRole = "admin" | "supplier" | "viewer" | "buyer";

type OrdersNotificationSnapshot = {
  total: number;
  overdue: string[];
  urgent: string[];
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
      urgent: [],
      statuses: {},
    };
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}-${role}`);
    if (!raw) {
      return {
        total: 0,
        overdue: [],
        urgent: [],
        statuses: {},
      };
    }
    const parsed = JSON.parse(raw) as Partial<OrdersNotificationSnapshot>;
    return {
      total: Number(parsed.total || 0),
      overdue: Array.isArray(parsed.overdue) ? parsed.overdue : [],
      urgent: Array.isArray(parsed.urgent) ? parsed.urgent : [],
      statuses: parsed.statuses || {},
    };
  } catch {
    return {
      total: 0,
      overdue: [],
      urgent: [],
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

  const attention = useMemo(() => getOrdersAttention(orders), [orders]);
  const overdueCount = attention.cards.find((card) => card.key === "overdue")?.count || 0;
  const urgentCount = attention.cards.find((card) => card.key === "urgent")?.count || 0;
  const overdueIds = useMemo(
    () =>
      orders
        .filter((order) => isOrderOverdue(order.order_items || []))
        .map((order) => String(order.id)),
    [orders]
  );
  const urgentIds = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            (order.order_type || "Стандартный") === "Срочный" &&
            !["Поставлен", "Отменен"].includes(getOrderStatus(order.order_items || []))
        )
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
      urgent: urgentIds,
      statuses: statusesSnapshot,
    };

    const tasks: Promise<void>[] = [];

    const newOrderCount = Object.keys(current.statuses).filter(
      (orderId) => !previous.statuses[orderId]
    ).length;
    const newlyOverdueCount = current.overdue.filter((id) => !previous.overdue.includes(id)).length;
    const newlyUrgentCount = current.urgent.filter((id) => !previous.urgent.includes(id)).length;

    let changedStatusesCount = 0;
    let newCancellationsCount = 0;

    for (const [orderId, snapshot] of Object.entries(current.statuses)) {
      const previousOrder = previous.statuses[orderId];
      if (!previousOrder) continue;

      if (snapshot.status !== previousOrder.status) {
        changedStatusesCount += 1;
      }

      if (snapshot.canceledCount > previousOrder.canceledCount) {
        newCancellationsCount += snapshot.canceledCount - previousOrder.canceledCount;
      }
    }

    if (newOrderCount > 0 && ["admin", "supplier", "buyer"].includes(userRole)) {
      tasks.push(
        showSystemNotification(
          "Новые заказы",
          newOrderCount === 1
            ? "Появился 1 новый заказ."
            : `Появилось новых заказов: ${newOrderCount}.`
        )
      );
    }

    if (newlyOverdueCount > 0 && ["admin", "supplier", "buyer"].includes(userRole)) {
      tasks.push(
        showSystemNotification(
          "Просроченные заказы",
          newlyOverdueCount === 1
            ? "Появился 1 новый просроченный заказ."
            : `Появилось новых просроченных заказов: ${newlyOverdueCount}.`
        )
      );
    }

    if (newlyUrgentCount > 0 && userRole === "admin") {
      tasks.push(
        showSystemNotification(
          "Срочные заказы",
          newlyUrgentCount === 1
            ? "Появился 1 новый срочный заказ."
            : `Появилось новых срочных заказов: ${newlyUrgentCount}.`
        )
      );
    }

    if (changedStatusesCount > 0 && ["admin", "buyer"].includes(userRole)) {
      tasks.push(
        showSystemNotification(
          "Изменение статусов",
          changedStatusesCount === 1
            ? "У одного заказа изменился статус."
            : `Изменились статусы заказов: ${changedStatusesCount}.`
        )
      );
    }

    if (newCancellationsCount > 0 && ["admin", "buyer"].includes(userRole)) {
      tasks.push(
        showSystemNotification(
          "Есть отмены",
          newCancellationsCount === 1
            ? "Появилась 1 новая отменённая позиция."
            : `Появилось новых отменённых позиций: ${newCancellationsCount}.`
        )
      );
    }

    writeSnapshot(userRole, current);
    void Promise.all(tasks);
  }, [
    orders.length,
    overdueIds,
    permission,
    statusesSnapshot,
    urgentIds,
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
          description: "Теперь приложение сможет сообщать о срочных и просроченных заказах.",
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
