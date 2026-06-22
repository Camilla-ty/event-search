"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EventCalendarGrid } from "@/src/features/events/components/explorer/EventCalendarGrid";
import { EventCalendarHeader } from "@/src/features/events/components/explorer/EventCalendarHeader";
import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  eventsIntersectMonth,
  getCurrentMonthKey,
  getMonthGridBounds,
  groupEventsByDay,
} from "@/src/features/events/lib/eventCalendarGrouping";
import { brandLinkClass } from "@/src/lib/design/classes";
import { buildEventExplorerCalendarUrl } from "@/src/lib/routes/explorerUrls";

type DiscoverCalendarPreviewProps = {
  events: readonly EventRecord[];
};

export function DiscoverCalendarPreview({ events }: DiscoverCalendarPreviewProps) {
  const [month, setMonth] = useState(getCurrentMonthKey);

  const bounds = useMemo(() => getMonthGridBounds(month), [month]);
  const monthEvents = useMemo(
    () => eventsIntersectMonth(events, month),
    [events, month],
  );
  const eventsByDay = useMemo(() => {
    if (bounds === null) return new Map<string, EventRecord[]>();
    return groupEventsByDay(monthEvents, bounds.gridStart, bounds.gridEnd);
  }, [bounds, monthEvents]);

  const fullCalendarHref = buildEventExplorerCalendarUrl(month);

  if (bounds === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-600">Invalid calendar month.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-0">
        <EventCalendarHeader month={month} onMonthChange={setMonth} />
        <EventCalendarGrid
          bounds={bounds}
          eventsByDay={eventsByDay}
          variant="compact"
          roundedBottom={monthEvents.length > 0}
        />
        {monthEvents.length === 0 ? (
          <p className="rounded-b-xl border border-t-0 border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-600 shadow-sm">
            No events this month
          </p>
        ) : null}
      </div>

      <Link href={fullCalendarHref} className={`text-sm ${brandLinkClass}`}>
        View full calendar →
      </Link>
    </div>
  );
}
