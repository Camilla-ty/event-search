import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { buildCalendarColorLayout } from "@/src/features/events/lib/eventCalendarColors";
import type { EventsByDay } from "@/src/features/events/lib/eventCalendarGrouping";
import { buildCalendarLaneLayout } from "@/src/features/events/lib/eventCalendarLanes";
import { buildCalendarSegmentLayout } from "@/src/features/events/lib/eventCalendarSegments";
import {
  listGridDays,
  type MonthGridBounds,
} from "@/src/features/events/lib/eventCalendarGrouping";

import {
  type EventCalendarDayCellVariant,
} from "./EventCalendarDayCell";
import { EventCalendarWeekRow } from "./EventCalendarWeekRow";

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
  const segmentLayout = buildCalendarSegmentLayout(colorLayout, bounds);
  const weekRows = Array.from({ length: Math.ceil(gridDays.length / 7) }, (_, index) =>
    gridDays.slice(index * 7, index * 7 + 7),
  );

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

      <div className={`${stretch ? "flex-1" : ""}`}>
        {weekRows.map((days) => (
          <EventCalendarWeekRow
            key={days.join("-")}
            days={days}
            month={bounds.month}
            eventsByDay={eventsByDay}
            segmentsByDay={segmentLayout.segmentsByDay}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
