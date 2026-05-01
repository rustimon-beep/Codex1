"use client";

export type FeedbackType = "tap" | "success" | "error" | "save";

const FEEDBACK_EVENT = "app-feedback";
const FEEDBACK_CLASS_DURATION: Record<FeedbackType | "row-highlight", number> = {
  tap: 160,
  success: 220,
  error: 240,
  save: 220,
  "row-highlight": 240,
};

const VIBRATION_PATTERNS: Record<FeedbackType, number | number[]> = {
  tap: 30,
  success: [40, 30, 60],
  error: [80, 40, 80],
  save: 40,
};

const FEEDBACK_CLASS_MAP: Record<FeedbackType, string> = {
  tap: "feedback-press",
  success: "feedback-success",
  error: "feedback-error",
  save: "feedback-save",
};

function supportsReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function runVibration(type: FeedbackType) {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;

  navigator.vibrate(VIBRATION_PATTERNS[type]);
}

function removeClassLater(target: HTMLElement, className: string, duration: number) {
  window.setTimeout(() => {
    target.classList.remove(className);
  }, duration);
}

export function applyFeedbackClass(
  target: HTMLElement | null | undefined,
  className: string,
  duration = 220
) {
  if (!target || typeof window === "undefined") return;

  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
  removeClassLater(target, className, duration);
}

export function pulseFeedbackElement(
  target: HTMLElement | null | undefined,
  type: FeedbackType
) {
  applyFeedbackClass(target, FEEDBACK_CLASS_MAP[type], FEEDBACK_CLASS_DURATION[type]);
}

export function highlightFeedbackRow(target: HTMLElement | null | undefined) {
  applyFeedbackClass(target, "feedback-row-highlight", FEEDBACK_CLASS_DURATION["row-highlight"]);
}

export function feedback(type: FeedbackType) {
  if (typeof window === "undefined") return;

  runVibration(type);

  window.dispatchEvent(
    new CustomEvent(FEEDBACK_EVENT, {
      detail: {
        type,
        reducedMotion: supportsReducedMotion(),
      },
    })
  );
}

export function installPressFeedback(root: Document | HTMLElement = document) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const getPressable = (eventTarget: EventTarget | null) => {
    if (!(eventTarget instanceof Element)) return null;

    return eventTarget.closest<HTMLElement>(
      'button, a[href], [role="button"], summary, input[type="button"], input[type="submit"]'
    );
  };

  const handlePointerDown = (event: Event) => {
    const target = getPressable(event.target);
    if (!target || target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") {
      return;
    }

    applyFeedbackClass(target, "feedback-press", FEEDBACK_CLASS_DURATION.tap);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const target = getPressable(event.target);
    if (!target || target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") {
      return;
    }

    applyFeedbackClass(target, "feedback-press", FEEDBACK_CLASS_DURATION.tap);
  };

  root.addEventListener("pointerdown", handlePointerDown as EventListener, true);
  root.addEventListener("keydown", handleKeyDown as EventListener, true);

  return () => {
    root.removeEventListener("pointerdown", handlePointerDown as EventListener, true);
    root.removeEventListener("keydown", handleKeyDown as EventListener, true);
  };
}

export function getFeedbackEventName() {
  return FEEDBACK_EVENT;
}
