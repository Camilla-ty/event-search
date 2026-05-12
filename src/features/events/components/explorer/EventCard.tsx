"use client";

import Link from "next/link";

import { Badge } from "@/src/components/common";

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
    <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-2">
        <h3 className="line-clamp-1 text-base font-semibold text-slate-900 dark:text-slate-100">
          {event.name ?? "Untitled Event"}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatDateRange(event.start_date, event.end_date)}
        </p>
        <p className="line-clamp-1 text-sm text-slate-600 dark:text-slate-300">
          {location || "Location not set"}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="neutral">{event.event_series?.name ?? "Event Series"}</Badge>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Link
          href={`/events/${event.slug ?? event.id}`}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          View Event
        </Link>
      </div>
    </article>
  );
}
