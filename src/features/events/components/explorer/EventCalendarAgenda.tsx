import Link from "next/link";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import type { EventsByDay } from "@/src/features/events/lib/eventCalendarGrouping";
import { listGridDays } from "@/src/features/events/lib/eventCalendarGrouping";
import { formatLocationLabel } from "@/src/lib/location/formatLocationLabel";
import { brandLinkClass } from "@/src/lib/design/classes";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

type EventCalendarAgendaProps = {
  monthStart: string;
  monthEnd: string;
  eventsByDay: EventsByDay<EventRecord>;
};

function formatAgendaDayLabel(isoDate: string): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function sortEventsByName(events: readonly EventRecord[]): EventRecord[] {
  return [...events].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }),
  );
}

export function EventCalendarAgenda({
  monthStart,
  monthEnd,
  eventsByDay,
}: EventCalendarAgendaProps) {
  const monthDays = listGridDays(monthStart, monthEnd);
  const daysWithEvents = monthDays.filter((isoDate) => (eventsByDay.get(isoDate)?.length ?? 0) > 0);

  return (
    <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {daysWithEvents.map((isoDate) => {
          const dayEvents = sortEventsByName(eventsByDay.get(isoDate) ?? []);

          return (
            <li key={isoDate} className="px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">{formatAgendaDayLabel(isoDate)}</h3>
              <ul className="mt-3 space-y-3">
                {dayEvents.map((event) => {
                  const href = buildEventDetailPath(event);
                  const location = formatLocationLabel({
                    city: event.cities?.name,
                    state: event.cities?.states?.name,
                    country: event.cities?.countries?.name,
                  });

                  return (
                    <li key={`${isoDate}-${event.id}`}>
                      {href ? (
                        <Link href={href} className={`block ${brandLinkClass}`}>
                          <span className="font-medium">{event.name ?? "Untitled Event"}</span>
                          {location !== "" ? (
                            <span className="mt-0.5 block text-xs font-normal text-slate-500">
                              {location}
                            </span>
                          ) : null}
                        </Link>
                      ) : (
                        <div>
                          <span className="font-medium text-slate-900">
                            {event.name ?? "Untitled Event"}
                          </span>
                          {location !== "" ? (
                            <span className="mt-0.5 block text-xs text-slate-500">{location}</span>
                          ) : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
