"use client";

export type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant?: "success" | "error" | "info";
};

type ToastViewportProps = {
  toasts: ToastItem[];
  onClose: (id: number) => void;
};

function getToastClasses(variant: ToastItem["variant"] = "info") {
  if (variant === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (variant === "error") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-slate-200 bg-white text-slate-800";
}

export function ToastViewport({ toasts, onClose }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-3 md:top-4 md:justify-end md:px-4">
      <div className="flex w-full max-w-md flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ${getToastClasses(
              toast.variant
            )}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{toast.title}</div>
                {toast.description ? (
                  <div className="mt-1 text-sm opacity-90">{toast.description}</div>
                ) : null}
              </div>

              <button
                onClick={() => onClose(toast.id)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-white/60"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}