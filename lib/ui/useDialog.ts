"use client";

import { useRef, useState } from "react";

type ConfirmDialogState = {
  open: boolean;
  title: string;
  description?: string;
  confirmText: string;
  variant?: "default" | "danger";
};

type PromptDialogState = {
  open: boolean;
  title: string;
  description?: string;
  confirmText: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  value: string;
};

export function useDialog() {
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    confirmText: "Подтвердить",
    variant: "default",
  });

  const promptResolverRef = useRef<((value: string | null) => void) | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptDialogState>({
    open: false,
    title: "",
    description: "",
    confirmText: "Сохранить",
    inputLabel: "",
    inputPlaceholder: "",
    value: "",
  });

  const requestConfirmation = (params: {
    title: string;
    description?: string;
    confirmText?: string;
    variant?: "default" | "danger";
  }) => {
    setConfirmDialog({
      open: true,
      title: params.title,
      description: params.description,
      confirmText: params.confirmText || "Подтвердить",
      variant: params.variant || "default",
    });

    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
    });
  };

  const closeConfirmDialog = (result: boolean) => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    confirmResolverRef.current?.(result);
    confirmResolverRef.current = null;
  };

  const requestPrompt = (params: {
    title: string;
    description?: string;
    confirmText?: string;
    inputLabel?: string;
    inputPlaceholder?: string;
  }) => {
    setPromptDialog({
      open: true,
      title: params.title,
      description: params.description,
      confirmText: params.confirmText || "Сохранить",
      inputLabel: params.inputLabel || "",
      inputPlaceholder: params.inputPlaceholder || "",
      value: "",
    });

    return new Promise<string | null>((resolve) => {
      promptResolverRef.current = resolve;
    });
  };

  const closePromptDialog = (result: string | null) => {
    setPromptDialog((prev) => ({ ...prev, open: false, value: "" }));
    promptResolverRef.current?.(result);
    promptResolverRef.current = null;
  };

  return {
    confirmDialog,
    promptDialog,
    setPromptDialog,
    requestConfirmation,
    closeConfirmDialog,
    requestPrompt,
    closePromptDialog,
  };
}
