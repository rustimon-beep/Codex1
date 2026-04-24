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
    return "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(220,252,231,0.92))] text-emerald-900";
  }

  if (variant === "error") {
    return "border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,228,230,0.92))] text-rose-900";
  }

  return "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] text-slate-900";
}

export function ToastViewport({ toasts, onClose }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-3 md:top-4 md:justify-end md:px-4">
      <div className="flex w-full max-w-md flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto relative overflow-hidden rounded-[22px] border px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl ${getToastClasses(
              toast.variant
            )}`}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_70%)]" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold md:text-sm">{toast.title}</div>
                {toast.description ? (
                  <div className="mt-1 text-[12px] opacity-90 md:text-sm">{toast.description}</div>
                ) : null}
              </div>

              <button
                onClick={() => onClose(toast.id)}
                className="rounded-xl px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-white/60"
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
