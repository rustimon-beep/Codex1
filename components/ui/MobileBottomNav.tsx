"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { triggerHapticFeedback, type HapticKind } from "../../lib/ui/haptics";

type MobileBottomNavItem = {
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: "default" | "accent" | "danger";
  haptic?: HapticKind;
};

type MobileBottomNavProps = {
  items: MobileBottomNavItem[];
};

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const visibleItems = items.filter(Boolean);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[40] px-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] md:hidden">
      <div className="pointer-events-auto mx-auto max-w-md rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(248,250,252,0.66))] p-1.5 shadow-[0_18px_54px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
        <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>
          {visibleItems.map((item) => {
            const toneClass =
              item.tone === "accent"
                ? item.active
                  ? "bg-slate-900 text-white"
                  : "text-slate-900"
                : item.tone === "danger"
                ? item.active
                  ? "bg-rose-600 text-white"
                  : "text-rose-600"
                : item.active
                ? "bg-slate-900 text-white"
                : "text-slate-600";

            const content = (
              <span
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[18px] px-2 text-center text-[10px] font-medium transition duration-300 active:scale-[0.99] ${toneClass} ${
                  item.disabled ? "opacity-40" : "hover:bg-slate-100/60"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center">{item.icon}</span>
                <span>{item.label}</span>
              </span>
            );

            if (item.href) {
              return (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  onClick={() => triggerHapticFeedback(item.haptic || "light")}
                  className={item.disabled ? "pointer-events-none" : ""}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  triggerHapticFeedback(item.haptic || "light");
                  item.onClick?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
