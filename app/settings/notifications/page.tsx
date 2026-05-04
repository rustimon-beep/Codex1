"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLogo } from "../../../components/ui/AppLogo";
import { EmptyStateCard } from "../../../components/ui/EmptyStateCard";
import { MobileLaunchReveal } from "../../../components/ui/MobileLaunchReveal";
import { PremiumIconTile } from "../../../components/ui/PremiumIconTile";
import { supabase } from "../../../lib/supabase";
import { useProfileAuth } from "../../../lib/auth/useProfileAuth";
import {
  NOTIFICATION_EVENT_DESCRIPTIONS,
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_ROLE_LABELS,
  NOTIFICATION_ROLES,
  getDefaultNotificationSettings,
  type NotificationChannel,
  type NotificationEventType,
  type NotificationRecipientRole,
  type NotificationSetting,
} from "../../../lib/notifications/settings";
import { feedback } from "@/src/lib/feedback";

type SettingsResponse = {
  settings: NotificationSetting[];
  tableMissing?: boolean;
};

function getSettingKey(eventType: NotificationEventType, role: NotificationRecipientRole) {
  return `${eventType}:${role}`;
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 rounded-full border transition ${
        checked
          ? "border-teal-500 bg-teal-500"
          : "border-slate-200 bg-slate-200"
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:brightness-105"}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const { user, authLoading, profileLoading } = useProfileAuth();
  const [settings, setSettings] = useState<NotificationSetting[]>(
    getDefaultNotificationSettings()
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [message, setMessage] = useState("");

  const settingsByKey = useMemo(
    () =>
      new Map(
        settings.map((setting) => [
          getSettingKey(setting.eventType, setting.role),
          setting,
        ])
      ),
    [settings]
  );

  const fetchWithAuth = useCallback(async (url: string, init?: RequestInit) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) throw new Error("Нет активной сессии.");

    return fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
  }, []);

  const loadSettings = useCallback(async () => {
    if (!user || user.role !== "admin") return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetchWithAuth("/api/notifications/settings");
      if (!response.ok) throw new Error("Не удалось загрузить настройки.");

      const data = (await response.json()) as SettingsResponse;
      setSettings(data.settings || getDefaultNotificationSettings());
      setTableMissing(Boolean(data.tableMissing));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить настройки.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, user]);

  useEffect(() => {
    if (!authLoading && !profileLoading) {
      void loadSettings();
    }
  }, [authLoading, loadSettings, profileLoading]);

  const updateSetting = (
    eventType: NotificationEventType,
    role: NotificationRecipientRole,
    channel: NotificationChannel
  ) => {
    feedback("tap");
    setSettings((current) =>
      current.map((setting) => {
        if (setting.eventType !== eventType || setting.role !== role) return setting;

        return channel === "push"
          ? { ...setting, pushEnabled: !setting.pushEnabled }
          : { ...setting, emailEnabled: !setting.emailEnabled };
      })
    );
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage("");
    feedback("save");

    try {
      const response = await fetchWithAuth("/api/notifications/settings", {
        method: "POST",
        body: JSON.stringify({ settings }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Не удалось сохранить настройки.");
      }

      setTableMissing(false);
      setMessage("Настройки сохранены.");
      feedback("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки.");
      feedback("error");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-transparent p-4 md:p-8">
        <EmptyStateCard
          title="Нет доступа"
          description="Настройки уведомлений доступны только администратору."
        />
      </div>
    );
  }

  return (
    <>
      <MobileLaunchReveal />
      <div className="min-h-screen bg-transparent p-3 text-slate-900 antialiased md:p-8">
        <div className="route-stage mx-auto max-w-7xl space-y-5">
          <section className="hero-premium relative overflow-hidden rounded-[24px] px-4 py-5 text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] md:rounded-[32px] md:px-8 md:py-7">
            <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.2),transparent_58%)]" />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <AppLogo compact showText={false} />
                <div>
                  <div className="glass-chip inline-flex rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-slate-200">
                    Настройки
                  </div>
                  <h1 className="mt-3 text-[28px] font-semibold tracking-tight md:text-[44px]">
                    Уведомления
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                    Управляй тем, кому и по какому каналу отправляются системные уведомления.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/"
                  className="glass-chip rounded-2xl px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/15"
                >
                  К заказам
                </Link>
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={saving || tableMissing}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_34px_rgba(15,23,42,0.16)] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </div>
          </section>

          {tableMissing ? (
            <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
              Таблица настроек ещё не создана в Supabase. Сейчас показаны настройки по умолчанию.
              Создай таблицу SQL-скриптом из ответа Codex, затем обнови страницу.
            </section>
          ) : null}

          {message ? (
            <section className="premium-shell rounded-[22px] px-5 py-4 text-sm text-slate-700">
              {message}
            </section>
          ) : null}

          <section className="premium-shell overflow-hidden rounded-[28px]">
            <div className="border-b border-slate-200 px-5 py-5 md:px-6">
              <div className="flex items-start gap-3">
                <PremiumIconTile
                  tone="emerald"
                  icon={
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M18 8A6 6 0 0 0 6 8C6 15 3 16 3 16H21S18 15 18 8" />
                      <path d="M10 20A2 2 0 0 0 14 20" />
                    </svg>
                  }
                />
                <div>
                  <div className="premium-kicker text-[11px] text-slate-400">
                    Матрица уведомлений
                  </div>
                  <h2 className="premium-ui-title mt-2 text-[24px] text-slate-900">
                    События, роли и каналы
                  </h2>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="skeleton h-24 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {NOTIFICATION_EVENTS.map((eventType) => (
                  <div key={eventType} className="px-4 py-5 md:px-6">
                    <div className="mb-4 flex flex-col gap-1 md:mb-5">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {NOTIFICATION_EVENT_LABELS[eventType]}
                      </h3>
                      <p className="text-sm leading-6 text-slate-500">
                        {NOTIFICATION_EVENT_DESCRIPTIONS[eventType]}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      {NOTIFICATION_ROLES.map((role) => {
                        const setting =
                          settingsByKey.get(getSettingKey(eventType, role)) ||
                          getDefaultNotificationSettings().find(
                            (defaultSetting) =>
                              defaultSetting.eventType === eventType &&
                              defaultSetting.role === role
                          );

                        return (
                          <div
                            key={`${eventType}-${role}`}
                            className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4"
                          >
                            <div className="mb-3 text-sm font-semibold text-slate-800">
                              {NOTIFICATION_ROLE_LABELS[role]}
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs text-slate-500">Push</span>
                              <Toggle
                                checked={Boolean(setting?.pushEnabled)}
                                disabled={saving || tableMissing}
                                onChange={() => updateSetting(eventType, role, "push")}
                              />
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="text-xs text-slate-500">Email</span>
                              <Toggle
                                checked={Boolean(setting?.emailEnabled)}
                                disabled={saving || tableMissing}
                                onChange={() => updateSetting(eventType, role, "email")}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
