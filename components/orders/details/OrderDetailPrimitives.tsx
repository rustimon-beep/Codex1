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
    <div className="premium-card-hover relative overflow-hidden rounded-[18px] bg-white p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 md:rounded-[24px] md:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-[radial-gradient(circle_at_top,rgba(180,138,76,0.08),transparent_68%)]" />
      <div className="premium-kicker text-[10px] text-slate-400 md:text-xs">
        {title}
      </div>
      <div className="mt-2.5 md:mt-3">
        {badgeClass ? (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium md:px-3 md:text-xs ${badgeClass}`}>
            {value}
          </span>
        ) : (
          <div className="premium-number text-[14px] font-medium text-slate-900 md:text-base">{value}</div>
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
            ? "mb-1 text-[10px] font-medium tracking-[0.06em] text-slate-500 md:mb-1.5 md:text-[11px]"
            : "mb-1.5 text-[12px] font-medium md:mb-2 md:text-sm"
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
      <div className="text-[10px] font-medium tracking-[0.06em] text-slate-400 md:text-[11px]">
        {label}
      </div>
      <div className="mt-1 text-[12px] leading-5 text-slate-700 md:text-sm md:leading-6">{value}</div>
    </div>
  );
}
