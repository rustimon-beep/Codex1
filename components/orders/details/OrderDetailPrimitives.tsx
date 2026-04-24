import type { ReactNode } from "react";

export function StatMini({
  title,
  value,
  badgeClass,
}: {
  title: string;
  value: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-200">
      <div className="text-xs font-medium tracking-[0.06em] text-slate-400">
        {title}
      </div>
      <div className="mt-3">
        {badgeClass ? (
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>
            {value}
          </span>
        ) : (
          <div className="text-base font-medium text-slate-900">{value}</div>
        )}
      </div>
    </div>
  );
}

export function FieldBlock({
  label,
  children,
  compact = false,
}: {
  label: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div>
      <label
        className={`block text-slate-700 ${
          compact
            ? "mb-1.5 text-[11px] font-medium tracking-[0.06em] text-slate-500"
            : "mb-2 text-sm font-medium"
        }`}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium tracking-[0.06em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm leading-6 text-slate-700">{value}</div>
    </div>
  );
}
