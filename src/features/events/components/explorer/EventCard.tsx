"use client";

import Link from "next/link";

import { Badge } from "@/src/components/common";
import { secondaryCtaClass } from "@/src/lib/design/classes";

import type { EventRecord } from "./types";

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Date TBC";
  if (!start) return end ?? "Date TBC";
  if (!end || end === start) return start;
  return `${start} - ${end}`;
}

export function EventCard({ event }: { event: EventRecord }) {
  const location = [event.cities?.name, event.cities?.countries?.name]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-2">
        <h3 className="line-clamp-1 text-base font-semibold text-slate-900">
          {event.name ?? "Untitled Event"}
        </h3>
        <p className="text-xs text-slate-500">
          {formatDateRange(event.start_date, event.end_date)}
        </p>
        <p className="line-clamp-1 text-sm text-slate-600">
          {location || "Location not set"}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="neutral">{event.event_series?.name ?? "Event Series"}</Badge>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Link
          href={`/events/${event.slug ?? event.id}`}
          className={`${secondaryCtaClass} h-9 w-full`}
        >
          View Event
        </Link>
      </div>
    </article>
  );
}
