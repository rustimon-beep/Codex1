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
        <div className="w-full rounded-t-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:max-w-md md:rounded-[28px]">
          <div className="px-4 py-4 md:px-5 md:py-5">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 md:hidden" />

            <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>

            {description ? (
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            ) : null}

            {typeof inputValue === "string" && onInputChange ? (
              <div className="mt-4">
                {inputLabel ? (
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {inputLabel}
                  </label>
                ) : null}
                <textarea
                  value={inputValue}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder={inputPlaceholder}
                  className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-end md:px-5">
            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {cancelText}
            </button>

            <button
              onClick={onConfirm}
              disabled={loading}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
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