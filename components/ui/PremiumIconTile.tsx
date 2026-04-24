"use client";

import type { ReactNode } from "react";

type PremiumIconTileProps = {
  icon: ReactNode;
  tone?: "slate" | "sky" | "emerald" | "amber" | "rose" | "violet";
};

function getToneClasses(tone: PremiumIconTileProps["tone"] = "slate") {
  if (tone === "sky") {
    return "border-stone-200/70 bg-[linear-gradient(180deg,rgba(250,250,249,0.98),rgba(245,245,244,0.9))] text-stone-800";
  }
  if (tone === "emerald") {
    return "border-emerald-200/70 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(209,250,229,0.9))] text-emerald-800";
  }
  if (tone === "amber") {
    return "border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(253,230,138,0.9))] text-amber-900";
  }
  if (tone === "rose") {
    return "border-rose-200/70 bg-[linear-gradient(180deg,rgba(255,241,242,0.98),rgba(255,228,230,0.9))] text-rose-800";
  }
  if (tone === "violet") {
    return "border-fuchsia-200/70 bg-[linear-gradient(180deg,rgba(253,244,255,0.98),rgba(245,208,254,0.9))] text-fuchsia-900";
  }

  return "border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.92))] text-slate-800";
}

export function PremiumIconTile({
  icon,
  tone = "slate",
}: PremiumIconTileProps) {
  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-[16px] border shadow-[0_14px_32px_rgba(15,23,42,0.08)] ${getToneClasses(
        tone
      )}`}
    >
      {icon}
    </div>
  );
}
