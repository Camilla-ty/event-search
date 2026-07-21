import type { EventRecord } from "@/src/features/events/components/explorer/types";
import type { EventsByDay } from "@/src/features/events/lib/eventCalendarGrouping";
import {
  isIsoDateInMonth,
  listGridDays,
  type MonthGridBounds,
} from "@/src/features/events/lib/eventCalendarGrouping";

import {
  EventCalendarDayCell,
  type EventCalendarDayCellVariant,
} from "./EventCalendarDayCell";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type EventCalendarGridProps = {
  bounds: MonthGridBounds;
  eventsByDay: EventsByDay<EventRecord>;
  variant?: EventCalendarDayCellVariant;
  roundedBottom?: boolean;
  stretch?: boolean;
};

export function EventCalendarGrid({
  bounds,
  eventsByDay,
  variant = "default",
  roundedBottom = true,
  stretch = false,
}: EventCalendarGridProps) {
  const gridDays = listGridDays(bounds.gridStart, bounds.gridEnd);

  return (
    <div
      className={`overflow-hidden border border-t-0 border-slate-200 bg-white ${
        roundedBottom ? "rounded-b-xl" : ""
      } ${stretch ? "flex min-h-0 flex-1 flex-col" : ""}`}
    >
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-r border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${stretch ? "flex-1 auto-rows-fr" : ""}`}>
        {gridDays.map((isoDate) => (
          <EventCalendarDayCell
            key={isoDate}
            isoDate={isoDate}
            isCurrentMonth={isIsoDateInMonth(isoDate, bounds.month)}
            events={eventsByDay.get(isoDate) ?? []}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
