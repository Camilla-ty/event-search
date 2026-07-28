"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  addMonthsToMonthKey,
  formatCalendarMonthLabel,
} from "@/src/features/events/lib/eventCalendarGrouping";

type EventCalendarHeaderProps = {
  month: string;
  onMonthChange: (month: string) => void;
};

const navButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2";
const yearButtonClass =
  "rounded px-1 text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30";
const YEAR_RADIUS = 3;

function buildMonthKeyWithYear(month: string, year: number): string {
  return `${String(year)}-${month.slice(5, 7)}`;
}

function buildNearbyYears(selectedYear: number): number[] {
  return Array.from({ length: YEAR_RADIUS * 2 + 1 }, (_, index) => selectedYear - YEAR_RADIUS + index);
}

export function EventCalendarHeader({ month, onMonthChange }: EventCalendarHeaderProps) {
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const yearPickerId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousMonth = addMonthsToMonthKey(month, -1);
  const nextMonth = addMonthsToMonthKey(month, 1);
  const monthLabel = formatCalendarMonthLabel(month);
  const selectedYear = Number(month.slice(0, 4));
  const monthText = monthLabel.replace(/\s+\d{4}$/, "");
  const nearbyYears = useMemo(() => buildNearbyYears(selectedYear), [selectedYear]);

  useEffect(() => {
    if (!yearPickerOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target)) {
        setYearPickerOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setYearPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [yearPickerOpen]);

  return (
    <div
      ref={rootRef}
      className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-3 rounded-t-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <button
        type="button"
        aria-label="Previous month"
        className={navButtonClass}
        disabled={previousMonth === null}
        onClick={() => {
          if (previousMonth !== null) onMonthChange(previousMonth);
        }}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>

      <div className="relative text-center text-lg font-semibold text-slate-900">
        <p>
          <span>{monthText} </span>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={yearPickerOpen}
            aria-controls={yearPickerId}
            className={yearButtonClass}
            onClick={() => setYearPickerOpen((current) => !current)}
          >
            {selectedYear}
          </button>
        </p>

        {yearPickerOpen ? (
          <div
            id={yearPickerId}
            role="dialog"
            aria-label="Choose calendar year"
            className="absolute left-1/2 top-full z-20 mt-2 w-28 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
          >
            <div className="flex flex-col gap-1">
              {nearbyYears.map((year) => {
                const isSelected = year === selectedYear;
                return (
                  <button
                    key={year}
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    className={`rounded-md px-2 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 ${
                      isSelected
                        ? "bg-brand-primary text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      onMonthChange(buildMonthKeyWithYear(month, year));
                      setYearPickerOpen(false);
                    }}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        aria-label="Next month"
        className={navButtonClass}
        disabled={nextMonth === null}
        onClick={() => {
          if (nextMonth !== null) onMonthChange(nextMonth);
        }}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
