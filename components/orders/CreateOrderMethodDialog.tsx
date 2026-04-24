"use client";

type CreateOrderMethodDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: "manual" | "photo" | "excel") => void;
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
];

export function CreateOrderMethodDialog({
  open,
  onClose,
  onSelect,
}: CreateOrderMethodDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-slate-950/45 backdrop-blur-[2px]">
      <div className="flex min-h-screen items-end justify-center p-0 md:items-center md:p-4">
        <div className="premium-shell w-full max-h-[100dvh] overflow-y-auto overscroll-contain rounded-t-[24px] shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:max-w-2xl md:max-h-[92dvh] md:rounded-[30px]">
          <div className="px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:py-6">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Новый заказ
                </div>
                <h3 className="premium-title mt-1.5 text-[16px] font-semibold tracking-tight text-slate-900 md:mt-2 md:text-[28px]">
                  Как создать заказ?
                </h3>
                <p className="mt-1 text-[11px] leading-4.5 text-slate-500 md:mt-1.5 md:text-sm md:leading-6">
                  Выбери удобный способ. Потом ты сможешь проверить и поправить позиции.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <div className="rounded-full border border-stone-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    Телефон: фото
                  </div>
                  <div className="rounded-full border border-stone-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    ПК: вручную или Excel
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-50 md:p-2"
                aria-label="Закрыть"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 5L15 15" />
                  <path d="M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="mt-3 rounded-[20px] border border-white/70 bg-white/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] md:mt-5 md:px-4 md:py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                Подсказка
              </div>
              <div className="mt-1 text-[11px] leading-4.5 text-slate-500 md:text-sm md:leading-6">
                На телефоне чаще всего удобнее начать с фото. На компьютере быстрее работать вручную или из Excel.
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:mt-5 md:grid-cols-3 md:gap-3">
              {OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSelect(option.key)}
                  className={`premium-card-hover rounded-[22px] border p-3 text-left shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition md:rounded-[24px] md:p-4 ${option.tone}`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/60 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] md:h-11 md:w-11 md:rounded-[16px]">
                    {option.icon}
                  </div>
                  <div className="mt-2.5 text-[14px] font-semibold tracking-tight md:mt-4 md:text-[16px]">
                    {option.title}
                  </div>
                  <div className="mt-2 inline-flex rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
                    {option.note}
                  </div>
                  <div className="mt-1.5 text-[10px] font-medium opacity-70">
                    {option.accent}
                  </div>
                  <div className="mt-1 text-[11px] leading-4.5 opacity-80 md:mt-1.5 md:text-[12px] md:leading-5">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
