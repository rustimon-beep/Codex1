"use client";

import { useEffect, useRef } from "react";

type ToastFn = (
  title: string,
  options?: {
    description?: string;
    variant?: "success" | "error" | "info";
  }
) => void;

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function getFriendlyErrorMessage(
  error: unknown,
  fallback = "Не удалось выполнить действие. Попробуй ещё раз."
) {
  if (isOffline()) {
    return "Похоже, пропал интернет. Проверь соединение и попробуй ещё раз.";
  }

  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
      ? error.message
      : "";

  if (!message) return fallback;

  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("fetch failed") ||
    lowerMessage.includes("load failed") ||
    lowerMessage.includes("networkerror") ||
    lowerMessage.includes("network request failed") ||
    lowerMessage.includes("network error")
  ) {
    return "Не удалось связаться с сервером. Проверь интернет и попробуй ещё раз.";
  }

  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("deadline exceeded")
  ) {
    return "Сервер отвечает слишком долго. Попробуй ещё раз через минуту.";
  }

  return message;
}

export function normalizeToastOptions(options?: {
  description?: string;
  variant?: "success" | "error" | "info";
}) {
  if (!options?.description) return options;

  return {
    ...options,
    description:
      options.variant === "error"
        ? getFriendlyErrorMessage(options.description, options.description)
        : options.description,
  };
}

export function useConnectionFeedback(showToast: ToastFn) {
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      wasOfflineRef.current = true;
      showToast("Нет соединения", {
        description:
          "Интернет пропал. Можно продолжать смотреть данные, но сохранение и загрузка могут не сработать.",
        variant: "error",
      });
    };

    const handleOnline = () => {
      if (!wasOfflineRef.current) return;

      wasOfflineRef.current = false;
      showToast("Соединение восстановлено", {
        description: "Интернет снова доступен. Можно продолжать работу.",
        variant: "success",
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [showToast]);
}
