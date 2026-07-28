import type { ReactNode } from "react";

import { getTodayIsoDate } from "@/src/features/events/lib/eventCalendarGrouping";

import {
  EventCalendarHiddenEventsPopover,
  type HiddenCalendarEvent,
} from "./EventCalendarHiddenEventsPopover";
const MAX_VISIBLE_LANES = 3;

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
  eventCount: number;
  overflowCount?: number;
  hiddenEvents?: readonly HiddenCalendarEvent[];
  variant?: EventCalendarDayCellVariant;
};

function renderLanePlaceholder(key: string, className = ""): ReactNode {
  return <div key={key} className={`h-5 ${className}`.trim()} aria-hidden="true" />;
}

export function EventCalendarDayCell({
  isoDate,
  isCurrentMonth,
  eventCount,
  overflowCount = 0,
  hiddenEvents = [],
  variant = "default",
}: EventCalendarDayCellProps) {
  const dayNumber = Number(isoDate.slice(8, 10));
  const isToday = isoDate === getTodayIsoDate();
  const isCompact = variant === "compact";
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
        <div className="space-y-1">
          {Array.from({ length: MAX_VISIBLE_LANES }, (_, lane) =>
            renderLanePlaceholder(`${isoDate}-lane-${lane}`),
          )}
          {overflowCount > 0 ? (
            <EventCalendarHiddenEventsPopover hiddenEvents={hiddenEvents} />
          ) : null}
        </div>
      ) : (
        <div className="space-y-1">
          {Array.from({ length: MAX_VISIBLE_LANES }, (_, lane) =>
            renderLanePlaceholder(`${isoDate}-lane-${lane}`),
          )}
          {overflowCount > 0 ? (
            <EventCalendarHiddenEventsPopover hiddenEvents={hiddenEvents} />
          ) : null}
        </div>
      )}
    </div>
  );
}
