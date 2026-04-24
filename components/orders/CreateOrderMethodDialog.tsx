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
        <div className="premium-shell w-full rounded-t-[24px] shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:max-w-2xl md:rounded-[30px]">
          <div className="px-4 py-4 md:px-6 md:py-6">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Новый заказ
                </div>
                <h3 className="premium-title mt-2 text-[20px] font-semibold tracking-tight text-slate-900 md:text-[28px]">
                  Как создать заказ?
                </h3>
                <p className="mt-1.5 text-[12px] leading-5 text-slate-500 md:text-sm md:leading-6">
                  Выбери удобный способ. Потом ты сможешь проверить и поправить позиции.
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

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSelect(option.key)}
                  className={`premium-card-hover rounded-[24px] border p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition ${option.tone}`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/60 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    {option.icon}
                  </div>
                  <div className="mt-4 text-[16px] font-semibold tracking-tight">
                    {option.title}
                  </div>
                  <div className="mt-1.5 text-[12px] leading-5 opacity-80">
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
