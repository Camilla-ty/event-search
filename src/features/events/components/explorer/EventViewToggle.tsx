"use client";

import type { ExplorerView } from "@/src/features/events/components/explorer/types";

type EventViewToggleProps = {
  view: ExplorerView;
  onViewChange: (view: ExplorerView) => void;
};

const toggleButtonClass =
  "inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2";

export function EventViewToggle({ view, onViewChange }: EventViewToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-300 bg-white p-1"
      role="group"
      aria-label="Events view"
    >
      <button
        type="button"
        aria-pressed={view === "list"}
        onClick={() => onViewChange("list")}
        className={`${toggleButtonClass} ${
          view === "list"
            ? "bg-brand-primary-muted text-brand-primary"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        List
      </button>
      <button
        type="button"
        aria-pressed={view === "calendar"}
        onClick={() => onViewChange("calendar")}
        className={`${toggleButtonClass} ${
          view === "calendar"
            ? "bg-brand-primary-muted text-brand-primary"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        Calendar
      </button>
    </div>
  );
}
