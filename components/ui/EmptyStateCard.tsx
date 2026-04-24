"use client";

type EmptyStateCardProps = {
  title: string;
  description: string;
  compact?: boolean;
};

export function EmptyStateCard({
  title,
  description,
  compact = false,
}: EmptyStateCardProps) {
  return (
    <div
      className={`premium-shell relative overflow-hidden rounded-[22px] px-5 py-6 text-center ring-1 ring-white/70 ${
        compact ? "md:px-6 md:py-7" : "md:px-10 md:py-12"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(180,138,76,0.12),transparent_65%)]" />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.94))] shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <path d="M8 10H16" />
          <path d="M8 14H13" />
        </svg>
      </div>
      <div className="premium-title mt-4 text-[16px] font-semibold tracking-tight text-slate-900 md:text-[22px]">
        {title}
      </div>
      <p className="premium-subtitle mx-auto mt-2 max-w-md text-[12px] leading-5 text-slate-500 md:text-sm md:leading-6">
        {description}
      </p>
    </div>
  );
}
