"use client";

import { useCallback, useRef, useState } from "react";
import type { ToastItem } from "../../components/ui/ToastViewport";

type ToastOptions = {
  description?: string;
  variant?: "success" | "error" | "info";
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);

  const showToast = useCallback((title: string, options?: ToastOptions) => {
    const variant = options?.variant || "info";
    const id = toastIdRef.current++;
    const toast: ToastItem = {
      id,
      title,
      description: options?.description,
      variant,
    };

    setToasts((prev) => {
      const duplicateExists = prev.some(
        (item) => item.title === title && item.description === options?.description
      );

      return duplicateExists ? prev : [...prev, toast];
    });

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, variant === "error" ? 4200 : variant === "success" ? 2600 : 3200);
  }, []);

  const closeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    closeToast,
  };
}
