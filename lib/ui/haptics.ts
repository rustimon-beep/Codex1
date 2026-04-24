export type HapticKind = "light" | "medium" | "success" | "warning";

const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 18,
  success: [12, 30, 18],
  warning: [20, 40, 20],
};

export function triggerHapticFeedback(kind: HapticKind = "light") {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;

  navigator.vibrate(HAPTIC_PATTERNS[kind]);
}
