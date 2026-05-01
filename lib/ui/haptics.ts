import { feedback } from "@/src/lib/feedback";

export type HapticKind = "light" | "medium" | "success" | "warning";

const HAPTIC_MAP: Record<HapticKind, Parameters<typeof feedback>[0]> = {
  light: "tap",
  medium: "tap",
  success: "success",
  warning: "error",
};

export function triggerHapticFeedback(kind: HapticKind = "light") {
  feedback(HAPTIC_MAP[kind]);
}
