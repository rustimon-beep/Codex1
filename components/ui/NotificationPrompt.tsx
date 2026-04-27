"use client";

type NotificationPromptProps = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  requesting: boolean;
  pushReady?: boolean;
  isIos: boolean;
  isStandalone: boolean;
  onEnable: () => void;
};

export function NotificationPrompt({
  supported,
  permission,
  requesting,
  pushReady,
  isIos,
  isStandalone,
  onEnable,
}: NotificationPromptProps) {
  if (!supported || permission === "unsupported") return null;

  if (permission === "granted") {
    return (
      <div className="rounded-[20px] border border-emerald-200 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 10L8 14L16 6" />
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-900 md:text-sm">
              Уведомления включены
            </div>
            <div className="mt-0.5 text-[12px] leading-5 text-slate-500 md:text-[13px]">
              {pushReady
                ? "Устройство подключено к push-уведомлениям о заказах."
                : "Разрешение получено. Если push ещё не настроен, часть уведомлений будет приходить только в открытом приложении."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 md:text-sm">
            Уведомления о заказах
          </div>
          <div className="mt-0.5 text-[12px] leading-5 text-slate-500 md:text-[13px]">
            Включи уведомления, чтобы не пропускать новые заказы, просрочки и важные изменения.
            {isIos && !isStandalone
              ? " На iPhone лучше сначала добавить приложение на экран домой."
              : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={onEnable}
          disabled={requesting}
          className="rounded-[14px] bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:text-[13px]"
        >
          {requesting ? "Запрашиваем..." : "Включить"}
        </button>
      </div>
    </div>
  );
}
