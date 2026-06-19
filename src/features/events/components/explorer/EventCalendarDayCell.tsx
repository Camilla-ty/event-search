import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { getTodayIsoDate } from "@/src/features/events/lib/eventCalendarGrouping";

import { EventCalendarEventChip } from "./EventCalendarEventChip";

const MAX_VISIBLE_EVENTS = 3;

type EventCalendarDayCellProps = {
  isoDate: string;
  isCurrentMonth: boolean;
  events: readonly EventRecord[];
};

export function EventCalendarDayCell({
  isoDate,
  isCurrentMonth,
  events,
}: EventCalendarDayCellProps) {
  const dayNumber = Number(isoDate.slice(8, 10));
  const isToday = isoDate === getTodayIsoDate();
  const sortedEvents = [...events].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }),
  );
  const visibleEvents = sortedEvents.slice(0, MAX_VISIBLE_EVENTS);
  const overflowCount = sortedEvents.length - visibleEvents.length;

  return (
    <div
      className={`min-h-28 border-b border-r border-slate-100 p-2 last:border-r-0 ${
        isCurrentMonth ? "bg-white" : "bg-slate-50/80"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-medium ${
            isToday
              ? "bg-brand-primary text-white"
              : isCurrentMonth
                ? "text-slate-900"
                : "text-slate-400"
          }`}
        >
          {dayNumber}
        </span>
      </div>

      <div className="space-y-1">
        {visibleEvents.map((event) => (
          <EventCalendarEventChip key={`${isoDate}-${event.id}`} event={event} />
        ))}
        {overflowCount > 0 ? (
          <p className="px-1 text-xs font-medium text-slate-500">+{overflowCount} more</p>
        ) : null}
      </div>
    </div>
  );
}
