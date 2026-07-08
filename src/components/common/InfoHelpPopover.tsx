"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type InfoHelpPopoverProps = {
  ariaLabel: string;
  title: string;
  children: ReactNode;
};

export function InfoHelpPopover({ ariaLabel, title, children }: InfoHelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold leading-none text-slate-500 transition hover:border-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20"
      >
        ?
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={title}
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3.5 text-left font-normal normal-case tracking-normal shadow-lg"
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}
