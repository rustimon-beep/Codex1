"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SESSION_KEY = "avtodom-mobile-launch-shown";

export function MobileLaunchReveal() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const wasShown = window.sessionStorage.getItem(SESSION_KEY) === "1";

    if (!isMobile || wasShown) {
      setReady(true);
      return;
    }

    setVisible(true);
    setReady(true);
    window.sessionStorage.setItem(SESSION_KEY, "1");

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 1350);

    return () => window.clearTimeout(timer);
  }, []);

  if (!ready || !visible) return null;

  return (
    <div className="mobile-launch fixed inset-0 z-[120] md:hidden">
      <div className="mobile-launch__backdrop" />
      <div className="mobile-launch__orb mobile-launch__orb--one" />
      <div className="mobile-launch__orb mobile-launch__orb--two" />
      <div className="mobile-launch__content">
        <div className="mobile-launch__logo-shell">
          <Image
            src="/avtodom-logo.png"
            alt="AVTODOM"
            width={120}
            height={120}
            className="mobile-launch__logo"
            priority
          />
        </div>
        <div className="mobile-launch__wordmark">AVTODOM</div>
        <div className="mobile-launch__subtitle">Orders</div>
      </div>
    </div>
  );
}
