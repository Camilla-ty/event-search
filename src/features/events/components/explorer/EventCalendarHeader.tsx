import { ChevronLeft, ChevronRight } from "lucide-react";

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

export function EventCalendarHeader({ month, onMonthChange }: EventCalendarHeaderProps) {
  const previousMonth = addMonthsToMonthKey(month, -1);
  const nextMonth = addMonthsToMonthKey(month, 1);

  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-3 rounded-t-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
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

      <p className="text-center text-lg font-semibold text-slate-900">
        {formatCalendarMonthLabel(month)}
      </p>

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
