"use client";

import { useEffect } from "react";
import { getFeedbackEventName, installPressFeedback, type FeedbackType } from "@/src/lib/feedback";

export function FeedbackEffects() {
  useEffect(() => {
    const uninstallPressFeedback = installPressFeedback(document);
    const feedbackEventName = getFeedbackEventName();

    const handleFeedback = (event: Event) => {
      const { detail } = event as CustomEvent<{ type?: FeedbackType }>;
      const feedbackType = detail?.type;

      if (!feedbackType || feedbackType === "tap") {
        return;
      }

      const className = `feedback-${feedbackType}`;
      document.body.classList.remove(className);
      void document.body.offsetWidth;
      document.body.classList.add(className);

      window.setTimeout(() => {
        document.body.classList.remove(className);
      }, 260);
    };

    window.addEventListener(feedbackEventName, handleFeedback as EventListener);

    return () => {
      uninstallPressFeedback();
      window.removeEventListener(feedbackEventName, handleFeedback as EventListener);
    };
  }, []);

  return null;
}
