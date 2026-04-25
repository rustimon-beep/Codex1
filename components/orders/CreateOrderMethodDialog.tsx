"use client";

import { useEffect } from "react";

type CreateOrderMethodDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: "manual" | "photo" | "excel" | "clipboard") => void;
};

const OPTIONS = [
  {
    key: "manual" as const,
    title: "Вручную",
    description: "Открыть пустую форму и добавить позиции самостоятельно.",
    note: "Лучше для десктопа",
    accent: "Спокойный старт",
    tone: "border-stone-200 bg-white text-slate-900",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 19H19" />
        <path d="M7 15L16.5 5.5L18.5 7.5L9 17H7V15Z" />
      </svg>
    ),
  },
  {
    key: "photo" as const,
    title: "По фото",
    description: "Загрузить фото документа и попробовать распознать позиции.",
    note: "Удобно с телефона",
    accent: "Камера и галерея",
    tone: "border-amber-200 bg-amber-50/90 text-amber-950",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7H8L10 5H14L16 7H20V19H4V7Z" />
        <circle cx="12" cy="13" r="3.2" />
      </svg>
    ),
  },
  {
    key: "excel" as const,
    title: "Из Excel",
    description: "Подгрузить таблицу с артикулом, наименованием и количеством.",
    note: "Быстро для готовых таблиц",
    accent: "Для пакетной загрузки",
    tone: "border-emerald-200 bg-emerald-50/90 text-emerald-950",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 3H14L19 8V21H7V3Z" />
        <path d="M14 3V8H19" />
        <path d="M9 12L13 16" />
        <path d="M13 12L9 16" />
      </svg>
    ),
  },
  {
    key: "clipboard" as const,
    title: "Из буфера",
    description: "Вставить список строк из буфера обмена и получить позиции автоматически.",
    note: "Удобно с ПК",
    accent: "Копировать и вставить",
    tone: "border-sky-200 bg-sky-50/90 text-sky-950",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="8" y="4" width="10" height="14" rx="2" />
        <path d="M6 8H5C3.9 8 3 8.9 3 10V19C3 20.1 3.9 21 5 21H13C14.1 21 15 20.1 15 19V18" />
        <path d="M10 2H16V6H10V2Z" />
      </svg>
    ),
  },
];

export function CreateOrderMethodDialog({
  open,
  onClose,
  onSelect,
}: CreateOrderMethodDialogProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-slate-950/45 backdrop-blur-[2px]">
      <div className="flex min-h-screen items-end justify-center p-0 md:items-center md:p-4">
        <div className="premium-shell flex h-[86dvh] w-full flex-col overflow-hidden rounded-t-[24px] shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:h-auto md:max-h-[92dvh] md:max-w-[920px] md:rounded-[30px]">
          <div className="shrink-0 border-b border-slate-100/80 px-4 py-3 md:px-6 md:py-6">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Новый заказ
                </div>
                <h3 className="premium-title mt-1.5 text-[16px] font-semibold tracking-tight text-slate-900 md:mt-2 md:text-[28px]">
                  Как создать заказ?
                </h3>
                <p className="mt-1 text-[11px] leading-4.5 text-slate-500 md:mt-1.5 md:text-sm md:leading-6">
                  Выбери способ и потом проверь позиции перед сохранением.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-50"
                aria-label="Закрыть"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 5L15 15" />
                  <path d="M15 5L5 15" />
                </svg>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 [webkit-overflow-scrolling:touch] md:px-6 md:py-6">
            <div className="md:hidden rounded-[18px] border border-white/70 bg-white/70 px-3 py-2.5 text-[11px] leading-4.5 text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              На телефоне удобнее фото, на ПК — Excel или буфер.
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 md:mt-0 md:grid-cols-2 xl:grid-cols-4 md:gap-3">
              {OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSelect(option.key)}
                  className={`premium-card-hover rounded-[22px] border p-3 text-left shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition md:rounded-[24px] md:p-4 ${option.tone}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-white/60 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] md:h-11 md:w-11 md:rounded-[16px]">
                      {option.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold tracking-tight md:text-[16px]">
                        {option.title}
                      </div>
                      <div className="mt-1 inline-flex rounded-full border border-white/60 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] opacity-80 md:px-2.5 md:py-1 md:text-[10px]">
                        {option.note}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[10px] font-medium opacity-70">
                    {option.accent}
                  </div>
                  <div className="mt-1 text-[11px] leading-4.5 opacity-80 md:mt-1.5 md:text-[12px] md:leading-5">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>

            <div className="h-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden" />
          </div>
        </div>
      </div>
    </div>
  );
}
