import type { Dispatch, SetStateAction } from "react";
import { getTodayDate } from "../../lib/orders/utils";

type QuickDateDialogState = {
  open: boolean;
  orderId: number | null;
  itemId: number | null;
  status: string;
  value: string;
  title: string;
  description?: string;
};

type QuickDateDialogProps = {
  dialog: QuickDateDialogState;
  setDialog: Dispatch<SetStateAction<QuickDateDialogState>>;
  closeDialog: () => void;
  confirmDialog: () => void | Promise<void>;
};

export function QuickDateDialog({
  dialog,
  setDialog,
  closeDialog,
  confirmDialog,
}: QuickDateDialogProps) {
  if (!dialog.open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] md:p-4">
      <div className="premium-shell w-full max-w-md rounded-[20px] p-3.5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:rounded-[28px] md:p-5">
        <div className="text-[10px] font-medium tracking-[0.06em] text-slate-400 md:text-[12px]">
          Быстрое обновление
        </div>
        <h3 className="premium-title mt-1.5 text-[16px] font-medium tracking-tight text-slate-900 md:mt-2 md:text-[22px]">
          {dialog.title}
        </h3>
        {dialog.description ? (
          <p className="mt-1.5 text-[12px] leading-5 text-slate-500 md:mt-2 md:text-sm md:leading-6">{dialog.description}</p>
        ) : null}

        <div className="mt-4 md:mt-5">
          <label className="mb-1.5 block text-[12px] font-medium text-slate-700 md:mb-2 md:text-sm">
            Дата поставки
          </label>
          <input
            type="date"
            min={getTodayDate()}
            value={dialog.value}
            onChange={(e) =>
              setDialog((prev) => ({
                ...prev,
                value: e.target.value,
              }))
            }
            className="premium-input w-full rounded-[18px] px-3.5 py-2.5 text-[12px] text-slate-900 outline-none md:rounded-2xl md:px-4 md:py-3.5 md:text-sm"
          />
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:mt-5">
          <button
            onClick={closeDialog}
            className="premium-button-soft w-full rounded-[18px] border border-slate-200 bg-white/92 px-4 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto md:rounded-2xl md:py-3 md:text-sm"
          >
            Отмена
          </button>
          <button
            onClick={() => void confirmDialog()}
            disabled={!dialog.value}
            className="premium-button w-full rounded-[18px] bg-slate-900 px-4 py-2 text-[12px] font-medium text-white transition hover:bg-slate-800 sm:w-auto md:rounded-2xl md:py-3 md:text-sm"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}
