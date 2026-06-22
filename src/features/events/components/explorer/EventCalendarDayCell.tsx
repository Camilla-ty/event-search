import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { getTodayIsoDate } from "@/src/features/events/lib/eventCalendarGrouping";

import { EventCalendarEventChip } from "./EventCalendarEventChip";

const MAX_VISIBLE_EVENTS = 3;
const COMPACT_MOBILE_VISIBLE_EVENTS = 1;
const COMPACT_DESKTOP_VISIBLE_EVENTS = 2;

export type EventCalendarDayCellVariant = "default" | "compact";

function formatDayCellAccessibleLabel(isoDate: string, eventCount: number): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const dateLabel = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  if (eventCount === 0) {
    return `${dateLabel}, no events`;
  }

  return `${dateLabel}, ${eventCount} ${eventCount === 1 ? "event" : "events"}`;
}

type EventCalendarDayCellProps = {
  isoDate: string;
  isCurrentMonth: boolean;
  events: readonly EventRecord[];
  variant?: EventCalendarDayCellVariant;
};

export function EventCalendarDayCell({
  isoDate,
  isCurrentMonth,
  events,
  variant = "default",
}: EventCalendarDayCellProps) {
  const dayNumber = Number(isoDate.slice(8, 10));
  const isToday = isoDate === getTodayIsoDate();
  const eventCount = events.length;
  const isCompact = variant === "compact";

  const sortedEvents = [...events].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }),
  );
  const visibleEvents = sortedEvents.slice(0, MAX_VISIBLE_EVENTS);
  const overflowCount = sortedEvents.length - visibleEvents.length;
  const compactMobileOverflow = Math.max(
    0,
    sortedEvents.length - COMPACT_MOBILE_VISIBLE_EVENTS,
  );
  const compactDesktopOverflow = Math.max(
    0,
    sortedEvents.length - COMPACT_DESKTOP_VISIBLE_EVENTS,
  );
  const primaryCompactEvent = sortedEvents[0];
  const secondaryCompactEvent = sortedEvents[1];
  const compactAccessibleLabel = isCompact
    ? formatDayCellAccessibleLabel(isoDate, eventCount)
    : undefined;
  const defaultAccessibleLabel =
    !isCompact && eventCount === 0
      ? formatDayCellAccessibleLabel(isoDate, eventCount)
      : undefined;

  return (
    <div
      role={isCompact ? "group" : undefined}
      aria-label={compactAccessibleLabel ?? defaultAccessibleLabel}
      className={`border-b border-r border-slate-100 p-2 last:border-r-0 ${
        isCompact ? "min-h-20 lg:min-h-24" : "min-h-28"
      } ${isCurrentMonth ? "bg-white" : "bg-slate-50/80"}`}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span
          aria-hidden={isCompact ? true : undefined}
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

      {isCompact ? (
        eventCount > 0 ? (
          <div className="space-y-1">
            {primaryCompactEvent ? (
              <EventCalendarEventChip
                key={`${isoDate}-${primaryCompactEvent.id}`}
                event={primaryCompactEvent}
              />
            ) : null}
            {secondaryCompactEvent ? (
              <div className="hidden lg:block">
                <EventCalendarEventChip
                  key={`${isoDate}-${secondaryCompactEvent.id}`}
                  event={secondaryCompactEvent}
                />
              </div>
            ) : null}
            {compactMobileOverflow > 0 ? (
              <p
                aria-hidden="true"
                className="px-1 text-xs font-medium text-slate-500 lg:hidden"
              >
                +{compactMobileOverflow} more
              </p>
            ) : null}
            {compactDesktopOverflow > 0 ? (
              <p
                aria-hidden="true"
                className="hidden px-1 text-xs font-medium text-slate-500 lg:block"
              >
                +{compactDesktopOverflow} more
              </p>
            ) : null}
          </div>
        ) : null
      ) : (
        <div className="space-y-1">
          {visibleEvents.map((event) => (
            <EventCalendarEventChip key={`${isoDate}-${event.id}`} event={event} />
          ))}
          {overflowCount > 0 ? (
            <p className="px-1 text-xs font-medium text-slate-500">+{overflowCount} more</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
