"use client";

import { Skeleton } from "../ui/Skeleton";

export function OrdersOverviewSkeleton() {
  return (
    <div className="space-y-3 md:space-y-5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[18px] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 md:rounded-[28px] md:p-5"
          >
            <Skeleton className="h-3 w-20 rounded-full md:h-4 md:w-24" />
            <Skeleton className="mt-3 h-8 w-16 rounded-2xl md:mt-4 md:h-10 md:w-20" />
            <Skeleton className="mt-3 h-1.5 w-14 rounded-full md:w-16" />
          </div>
        ))}
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-6">
        <Skeleton className="h-5 w-40 rounded-full md:h-7 md:w-56" />
        <Skeleton className="mt-2 h-3 w-52 rounded-full md:h-4 md:w-80" />
        <Skeleton className="mt-4 h-[42px] w-full rounded-[18px] md:mt-5 md:h-[56px] md:rounded-2xl" />
      </div>

      <div className="space-y-2 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
          >
            <Skeleton className="h-4 w-36 rounded-full" />
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Skeleton className="h-10 rounded-2xl" />
              <Skeleton className="h-10 rounded-2xl" />
              <Skeleton className="h-10 rounded-2xl" />
              <Skeleton className="h-10 rounded-2xl" />
            </div>
            <Skeleton className="mt-3 h-12 rounded-[16px]" />
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)] md:block">
        <div className="p-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-8 gap-4 border-b border-slate-100 py-4 last:border-b-0">
              {Array.from({ length: 8 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-5 rounded-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[18px] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 md:rounded-[24px] md:p-5"
          >
            <Skeleton className="h-3 w-16 rounded-full" />
            <Skeleton className="mt-3 h-6 w-24 rounded-full md:h-7 md:w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-4 md:space-y-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-6"
            >
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="mt-2 h-6 w-48 rounded-full" />
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                {Array.from({ length: 4 }).map((__, fieldIndex) => (
                  <Skeleton key={fieldIndex} className="h-12 rounded-2xl md:h-14" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 md:space-y-5">
          <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-6">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="mt-3 h-24 rounded-[20px]" />
            <Skeleton className="mt-3 h-24 rounded-[20px]" />
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-6">
            <Skeleton className="h-12 rounded-2xl md:h-14" />
          </div>
        </div>
      </div>
    </div>
  );
}
