"use client";

import { useMemo } from "react";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  eventsIntersectMonth,
  getMonthGridBounds,
  groupEventsByDay,
} from "@/src/features/events/lib/eventCalendarGrouping";

import { EventCalendarAgenda } from "./EventCalendarAgenda";
import { EventCalendarGrid } from "./EventCalendarGrid";
import { EventCalendarHeader } from "./EventCalendarHeader";

type EventCalendarProps = {
  events: readonly EventRecord[];
  month: string;
  onMonthChange: (month: string) => void;
};

export function EventCalendar({ events, month, onMonthChange }: EventCalendarProps) {
  const bounds = useMemo(() => getMonthGridBounds(month), [month]);
  const monthEvents = useMemo(
    () => eventsIntersectMonth(events, month),
    [events, month],
  );
  const eventsByDay = useMemo(() => {
    if (bounds === null) return new Map<string, EventRecord[]>();
    return groupEventsByDay(monthEvents, bounds.gridStart, bounds.gridEnd);
  }, [bounds, monthEvents]);
  const monthAgendaByDay = useMemo(() => {
    if (bounds === null) return new Map<string, EventRecord[]>();
    return groupEventsByDay(monthEvents, bounds.monthStart, bounds.monthEnd);
  }, [bounds, monthEvents]);

  if (bounds === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-600">Invalid calendar month.</p>
      </div>
    );
  }

  return (
    <section className="space-y-0">
      <EventCalendarHeader month={month} onMonthChange={onMonthChange} />
      {monthEvents.length === 0 ? (
        <div className="rounded-b-xl border border-t-0 border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-sm text-slate-600">No events in this month</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <EventCalendarGrid bounds={bounds} eventsByDay={eventsByDay} />
          </div>
          <div className="md:hidden">
            <EventCalendarAgenda
              monthStart={bounds.monthStart}
              monthEnd={bounds.monthEnd}
              eventsByDay={monthAgendaByDay}
            />
          </div>
        </>
      )}
    </section>
  );
}
