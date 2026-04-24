import type { Dispatch, SetStateAction } from "react";

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="text-[12px] font-medium tracking-[0.06em] text-slate-400">
          Быстрое обновление
        </div>
        <h3 className="mt-2 text-[22px] font-medium tracking-tight text-slate-900">
          {dialog.title}
        </h3>
        {dialog.description ? (
          <p className="mt-2 text-sm leading-6 text-slate-500">{dialog.description}</p>
        ) : null}

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Дата поставки
          </label>
          <input
            type="date"
            value={dialog.value}
            onChange={(e) =>
              setDialog((prev) => ({
                ...prev,
                value: e.target.value,
              }))
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={closeDialog}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Отмена
          </button>
          <button
            onClick={() => void confirmDialog()}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 sm:w-auto"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}
