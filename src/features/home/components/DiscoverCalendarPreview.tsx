"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EventCalendarGrid } from "@/src/features/events/components/explorer/EventCalendarGrid";
import { EventCalendarHeader } from "@/src/features/events/components/explorer/EventCalendarHeader";
import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  eventsIntersectMonth,
  formatCalendarMonthLabel,
  getCurrentMonthKey,
  getMonthGridBounds,
  groupEventsByDay,
} from "@/src/features/events/lib/eventCalendarGrouping";
import { buildEventExplorerMonthUrl } from "@/src/lib/routes/explorerUrls";

/** Match Discover compact list footer interaction styles. */
const calendarMonthFooterClass = [
  "mt-auto block rounded-b-xl border border-t-0 border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-600 shadow-sm transition",
  "hover:bg-slate-50 hover:text-brand-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2",
].join(" ");

type DiscoverCalendarPreviewProps = {
  events: readonly EventRecord[];
  /** Optional fixed month for tests; defaults to the current UTC month. */
  initialMonth?: string;
};

export function DiscoverCalendarPreview({
  events,
  initialMonth,
}: DiscoverCalendarPreviewProps) {
  const [month, setMonth] = useState(() => initialMonth?.trim() || getCurrentMonthKey());

  const bounds = useMemo(() => getMonthGridBounds(month), [month]);
  const monthEvents = useMemo(
    () => eventsIntersectMonth(events, month),
    [events, month],
  );
  const eventsByDay = useMemo(() => {
    if (bounds === null) return new Map<string, EventRecord[]>();
    return groupEventsByDay(monthEvents, bounds.gridStart, bounds.gridEnd);
  }, [bounds, monthEvents]);
  const monthExplorerHref = useMemo(() => buildEventExplorerMonthUrl(month), [month]);
  const monthExplorerLabel = useMemo(
    () => `Browse events in ${formatCalendarMonthLabel(month)}`,
    [month],
  );

  if (bounds === null || monthExplorerHref === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-600">Invalid calendar month.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <EventCalendarHeader month={month} onMonthChange={setMonth} />
      <EventCalendarGrid
        bounds={bounds}
        eventsByDay={eventsByDay}
        variant="compact"
        roundedBottom={false}
        stretch
      />
      <Link href={monthExplorerHref} className={calendarMonthFooterClass}>
        {monthExplorerLabel}
      </Link>
    </div>
  );
}
