"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import type { CalendarColorFamily } from "@/src/features/events/lib/eventCalendarColors";

import { EventCalendarEventChip } from "./EventCalendarEventChip";

export type HiddenCalendarEvent = {
  event: EventRecord;
  colorFamily: CalendarColorFamily;
};

type EventCalendarHiddenEventsPopoverProps = {
  hiddenEvents: readonly HiddenCalendarEvent[];
};

export function EventCalendarHiddenEventsPopover({
  hiddenEvents,
}: EventCalendarHiddenEventsPopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hiddenCount = hiddenEvents.length;
  const triggerLabel = `Show ${hiddenCount} more event${hiddenCount === 1 ? "" : "s"}`;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (hiddenCount === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-controls={popoverId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        className="px-1 text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
        onClick={() => setOpen((value) => !value)}
      >
        +{hiddenCount} more
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Hidden events"
          className="absolute left-0 top-full z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          <ul className="space-y-1">
            {hiddenEvents.map((item) => (
              <li key={item.event.id}>
                <EventCalendarEventChip
                  event={item.event}
                  colorFamily={item.colorFamily}
                  segmentType="single"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
