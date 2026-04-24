"use client";

type AppDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText: string;
  cancelText?: string;
  variant?: "default" | "danger";
  inputLabel?: string;
  inputValue?: string;
  inputPlaceholder?: string;
  onInputChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function AppDialog({
  open,
  title,
  description,
  confirmText,
  cancelText = "Отмена",
  variant = "default",
  inputLabel,
  inputValue,
  inputPlaceholder,
  onInputChange,
  onConfirm,
  onCancel,
  loading = false,
}: AppDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-[2px]">
      <div className="flex min-h-screen items-end justify-center p-0 md:items-center md:p-4">
        <div className="premium-shell w-full rounded-t-[20px] shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:max-w-md md:rounded-[28px]">
          <div className="px-3 py-3 md:px-5 md:py-5">
            <div className="mx-auto mb-2 h-1.5 w-9 rounded-full bg-slate-200 md:hidden" />

            <h3 className="premium-title text-[17px] font-semibold tracking-tight text-slate-900 md:text-lg">{title}</h3>

            {description ? (
              <p className="mt-1.5 text-[12px] leading-5 text-slate-500 md:mt-2 md:text-sm md:leading-6">{description}</p>
            ) : null}

            {typeof inputValue === "string" && onInputChange ? (
              <div className="mt-3.5 md:mt-4">
                {inputLabel ? (
                  <label className="mb-1.5 block text-[12px] font-medium text-slate-700 md:text-sm">
                    {inputLabel}
                  </label>
                ) : null}
                <textarea
                  value={inputValue}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder={inputPlaceholder}
                  className="premium-input min-h-[90px] w-full rounded-[18px] px-3 py-2 text-[12px] text-slate-900 outline-none placeholder:text-slate-400 md:min-h-[110px] md:rounded-2xl md:px-3 md:py-2.5 md:text-sm"
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-3 py-3 sm:flex-row sm:justify-end md:px-5 md:py-4">
            <button
              onClick={onCancel}
              disabled={loading}
              className="premium-button-soft w-full rounded-[18px] border border-slate-200 bg-white/92 px-4 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto md:rounded-2xl md:py-3 md:text-sm"
            >
              {cancelText}
            </button>

            <button
              onClick={onConfirm}
              disabled={loading}
              className={`premium-button w-full rounded-[18px] px-4 py-2 text-[12px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto md:rounded-2xl md:py-3 md:text-sm ${
                variant === "danger"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              {loading ? "Подтверждение..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
