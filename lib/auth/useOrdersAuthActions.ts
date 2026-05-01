"use client";

import { useCallback } from "react";
import { supabase } from "../supabase";
import { clearCachedProfile, fetchUserProfile } from "./profile";
import type { UserProfile } from "../orders/types";
import { removePushSubscription } from "../notifications/push-subscriptions";
import { feedback } from "@/src/lib/feedback";

type LoginFormState = {
  login: string;
  password: string;
};

type ToastFn = (
  title: string,
  options?: { description?: string; variant?: "success" | "error" | "info" }
) => void;

export function useOrdersAuthActions(params: {
  loginForm: LoginFormState;
  setLoginError: (value: string) => void;
  setProfileLoading: (value: boolean) => void;
  setUser: (value: UserProfile | null) => void;
  setLoginForm: (value: LoginFormState) => void;
  currentUser: UserProfile | null;
  showToast: ToastFn;
}) {
  const {
    loginForm,
    setLoginError,
    setProfileLoading,
    setUser,
    setLoginForm,
    currentUser,
    showToast,
  } = params;

  const login = useCallback(async () => {
    setLoginError("");

    const normalizedEmail = loginForm.login.trim().toLowerCase();
    const rawPassword = loginForm.password;

    if (!normalizedEmail || !rawPassword) {
      feedback("error");
      setLoginError("Заполни email и пароль");
      showToast("Не удалось войти", {
        description: "Заполни оба поля перед входом.",
        variant: "error",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: rawPassword,
    });

    if (error) {
      feedback("error");
      setLoginError(error.message || "Неверный email или пароль");
      showToast("Не удалось войти", {
        description: error.message || "Проверь email и пароль.",
        variant: "error",
      });
      return;
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      feedback("error");
      setLoginError("Не удалось получить пользователя");
      showToast("Ошибка авторизации", {
        description: "Не удалось получить пользователя.",
        variant: "error",
      });
      return;
    }

    setProfileLoading(true);
    const profile = await fetchUserProfile(authUser.id);

    if (!profile) {
      setLoginError("Профиль пользователя не найден");
      await supabase.auth.signOut();
      setProfileLoading(false);
      feedback("error");
      showToast("Профиль не найден", {
        description: "Пользователь есть, но профиль не найден.",
        variant: "error",
      });
      return;
    }

    setUser(profile);
    setProfileLoading(false);
    setLoginError("");
    feedback("success");
    showToast("Вход выполнен", { variant: "success" });
  }, [
    loginForm.login,
    loginForm.password,
    setLoginError,
    setProfileLoading,
    setUser,
    showToast,
  ]);

  const logout = useCallback(async () => {
    if (currentUser) {
      clearCachedProfile(currentUser.id);
    }

    await removePushSubscription().catch(() => {});
    await supabase.auth.signOut();
    setUser(null);
    setLoginForm({ login: "", password: "" });
    feedback("tap");
    showToast("Вы вышли из системы", { variant: "info" });
  }, [currentUser, setLoginForm, setUser, showToast]);

  return {
    login,
    logout,
  };
}
