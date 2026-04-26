"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderWithItems } from "../orders/types";
import { getOrdersAttention } from "../orders/selectors";

type ToastFn = (
  title: string,
  options?: {
    description?: string;
    variant?: "success" | "error" | "info";
  }
) => void;

const STORAGE_KEY = "avtodom-notification-snapshot-v1";

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

type OrdersNotificationSnapshot = {
  overdue: number;
  urgent: number;
};

function readSnapshot(): OrdersNotificationSnapshot {
  if (typeof window === "undefined") {
    return { overdue: 0, urgent: 0 };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { overdue: 0, urgent: 0 };
    const parsed = JSON.parse(raw) as Partial<OrdersNotificationSnapshot>;
    return {
      overdue: Number(parsed.overdue || 0),
      urgent: Number(parsed.urgent || 0),
    };
  } catch {
    return { overdue: 0, urgent: 0 };
  }
}

function writeSnapshot(snapshot: OrdersNotificationSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function useOrdersNotifications(params: {
  orders: OrderWithItems[];
  showToast: ToastFn;
}) {
  const { orders, showToast } = params;
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [requesting, setRequesting] = useState(false);

  const attention = useMemo(() => getOrdersAttention(orders), [orders]);
  const overdueCount = attention.cards.find((card) => card.key === "overdue")?.count || 0;
  const urgentCount = attention.cards.find((card) => card.key === "urgent")?.count || 0;

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

    const previous = readSnapshot();
    const current = {
      overdue: overdueCount,
      urgent: urgentCount,
    };

    const tasks: Promise<void>[] = [];

    if (current.overdue > previous.overdue) {
      const delta = current.overdue - previous.overdue;
      tasks.push(
        showSystemNotification(
          "Просроченные заказы",
          delta === 1
            ? "Появился 1 новый просроченный заказ."
            : `Появилось новых просроченных заказов: ${delta}.`
        )
      );
    }

    if (current.urgent > previous.urgent) {
      const delta = current.urgent - previous.urgent;
      tasks.push(
        showSystemNotification(
          "Срочные заказы",
          delta === 1
            ? "Появился 1 новый срочный заказ."
            : `Появилось новых срочных заказов: ${delta}.`
        )
      );
    }

    writeSnapshot(current);
    void Promise.all(tasks);
  }, [overdueCount, permission, urgentCount]);

  const requestPermission = useCallback(async () => {
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
