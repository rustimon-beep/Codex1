"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { OrderWithItems } from "../orders/types";
import {
  ensureOverdueNotificationEvents,
  fetchNotificationRecipientById,
  fetchPendingNotifications,
  markNotificationDelivered,
} from "../notifications/api";
import { ensurePushSubscription } from "../notifications/push-subscriptions";

type ToastFn = (
  title: string,
  options?: {
    description?: string;
    variant?: "success" | "error" | "info";
  }
) => void;

type UserRole = "admin" | "supplier" | "viewer" | "buyer";

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

async function showSystemNotification(
  title: string,
  body: string,
  options?: {
    tag?: string;
    requireInteraction?: boolean;
  }
) {
  const icon = "/icon-192.png";

  try {
    const registration = await ensureServiceWorker();
    if (registration?.showNotification) {
      await registration.showNotification(title, {
        body,
        icon,
        badge: icon,
        tag: options?.tag || `avtodom-${title}`,
        requireInteraction: options?.requireInteraction,
      });
      return;
    }
  } catch {}

  if (supportsNotifications() && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon,
      tag: options?.tag,
      requireInteraction: options?.requireInteraction,
    });
  }
}

function canShowInForeground() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

export function useOrdersNotifications(params: {
  userId: string | null;
  userRole: UserRole;
  orders: OrderWithItems[];
  showToast: ToastFn;
}) {
  const { userId, userRole, orders, showToast } = params;
  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [requesting, setRequesting] = useState(false);
  const [pushReady, setPushReady] = useState(false);

  const showPendingNotifications = useCallback(
    async (targetUserId: string) => {
      const pending = await fetchPendingNotifications(targetUserId);

      for (const recipient of pending) {
        if (!recipient.notification_events) continue;
        if (!canShowInForeground()) continue;

        await showSystemNotification(
          recipient.notification_events.title,
          recipient.notification_events.body,
          {
            tag: recipient.notification_events.event_key,
            requireInteraction:
              recipient.notification_events.event_type === "overdue" ||
              recipient.notification_events.event_type === "cancellation",
          }
        );
        await markNotificationDelivered(recipient.id);
      }
    },
    []
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
    if (!userId || userRole === "viewer") {
      setPushReady(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    if (!userId || userRole === "viewer") return;

    void ensureOverdueNotificationEvents(orders).catch(() => {});
  }, [orders, userId, userRole]);

  useEffect(() => {
    if (!userId || permission !== "granted" || userRole === "viewer") return;

    if (!publicVapidKey) {
      setPushReady(false);
      return;
    }

    let active = true;

    const registerPush = async () => {
      try {
        const ready = await ensurePushSubscription({
          userId,
          publicKey: publicVapidKey,
        });

        if (active) {
          setPushReady(ready);
        }
      } catch {
        if (active) {
          setPushReady(false);
        }
      }
    };

    void registerPush();

    return () => {
      active = false;
    };
  }, [permission, publicVapidKey, userId, userRole]);

  useEffect(() => {
    if (!userId || permission !== "granted" || userRole === "viewer") return;

    let cancelled = false;

    const loadPending = async () => {
      try {
        if (cancelled) return;
        await showPendingNotifications(userId);
      } catch {}
    };

    void loadPending();

    const intervalId = window.setInterval(() => {
      void loadPending();
    }, 15000);

    const channel = supabase
      .channel(`notification-recipients-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_recipients",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const recipientId = Number(payload.new.id);
          if (!recipientId) return;

          try {
            const recipient = await fetchNotificationRecipientById(recipientId);
            if (!recipient.notification_events || recipient.delivered_at) return;
            if (!canShowInForeground()) return;

            await showSystemNotification(
              recipient.notification_events.title,
              recipient.notification_events.body,
              {
                tag: recipient.notification_events.event_key,
                requireInteraction:
                  recipient.notification_events.event_type === "overdue" ||
                  recipient.notification_events.event_type === "cancellation",
              }
            );
            await markNotificationDelivered(recipient.id);
          } catch {}
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };
  }, [permission, showPendingNotifications, userId, userRole]);

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
        if (userId && publicVapidKey) {
          await ensurePushSubscription({
            userId,
            publicKey: publicVapidKey,
          });
          setPushReady(true);
        }
        showToast("Уведомления включены", {
          description:
            publicVapidKey
              ? "Теперь устройство подписано на push-уведомления о заказах."
              : "Разрешение получено. Для полноценного push ещё нужен публичный VAPID-ключ.",
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
  }, [publicVapidKey, showToast, userId, userRole]);

  return {
    supported: supportsNotifications(),
    permission,
    requesting,
    pushReady,
    requestPermission,
    isStandalone: isStandaloneMode(),
    isIos: isIos(),
  };
}
