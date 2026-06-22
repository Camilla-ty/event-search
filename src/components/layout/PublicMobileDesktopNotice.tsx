"use client";

import { useEffect, useRef, useState } from "react";

import { primaryCtaClass } from "@/src/lib/design/classes";

const STORAGE_KEY = "eventpixels.public.mobileDesktopNotice.dismissed";

export function PublicMobileDesktopNotice() {
  const [visible, setVisible] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        dismissedRef.current = true;
        return;
      }
    } catch {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncVisibility = () => {
      setVisible(mediaQuery.matches && !dismissedRef.current);
    };

    syncVisibility();
    mediaQuery.addEventListener("change", syncVisibility);
    return () => mediaQuery.removeEventListener("change", syncVisibility);
  }, []);

  useEffect(() => {
    if (!visible) return;

    continueRef.current?.focus();

    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyLeft = document.body.style.left;
    const previousBodyRight = document.body.style.right;
    const previousBodyWidth = document.body.style.width;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.left = previousBodyLeft;
      document.body.style.right = previousBodyRight;
      document.body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [visible]);

  function handleContinue() {
    dismissedRef.current = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures; still dismiss for this session.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 md:hidden">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-mobile-desktop-notice-message"
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <p id="public-mobile-desktop-notice-message" className="text-sm text-slate-700">
          For the best experience, we recommend using the desktop version.
        </p>
        <button
          ref={continueRef}
          type="button"
          className={`${primaryCtaClass} mt-4 h-10 w-full`}
          onClick={handleContinue}
        >
          Continue on mobile
        </button>
      </div>
    </div>
  );
}
