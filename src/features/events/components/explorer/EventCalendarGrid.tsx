import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { buildCalendarColorLayout } from "@/src/features/events/lib/eventCalendarColors";
import type { EventsByDay } from "@/src/features/events/lib/eventCalendarGrouping";
import { buildCalendarLaneLayout } from "@/src/features/events/lib/eventCalendarLanes";
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

function collectUniqueEvents(eventsByDay: EventsByDay<EventRecord>): EventRecord[] {
  const byId = new Map<string, EventRecord>();

  for (const dayEvents of eventsByDay.values()) {
    for (const event of dayEvents) {
      if (!byId.has(event.id)) {
        byId.set(event.id, event);
      }
    }
  }

  return [...byId.values()];
}

export function EventCalendarGrid({
  bounds,
  eventsByDay,
  variant = "default",
  roundedBottom = true,
  stretch = false,
}: EventCalendarGridProps) {
  const gridDays = listGridDays(bounds.gridStart, bounds.gridEnd);
  const visibleEvents = collectUniqueEvents(eventsByDay);
  const laneLayout = buildCalendarLaneLayout(visibleEvents, bounds);
  const colorLayout = buildCalendarColorLayout(laneLayout, bounds);

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
            colorByEventId={colorLayout.colorByEventId}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
