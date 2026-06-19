"use client";

import { useEffect, useState } from "react";

import { primaryCtaClass } from "@/src/lib/design/classes";

const STORAGE_KEY = "eventpixels.public.mobileDesktopNotice.dismissed";

export function PublicMobileDesktopNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    if (!mediaQuery.matches) return;

    setVisible(true);
  }, []);

  function handleContinue() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures; still dismiss for this session.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-lg md:hidden"
      role="dialog"
      aria-live="polite"
      aria-label="Mobile experience notice"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <p className="text-sm text-slate-700">
          For the best experience, we recommend using the desktop version.
        </p>
        <button type="button" className={`${primaryCtaClass} h-10 w-full`} onClick={handleContinue}>
          Continue on mobile
        </button>
      </div>
    </div>
  );
}
