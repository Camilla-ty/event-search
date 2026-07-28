import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { readEventDateRange } from "@/src/features/events/lib/readEventIsoDate";

function calendarDurationDays(event: EventRecord): number {
  const range = readEventDateRange(event);
  if (range === null) return 1;

  const start = new Date(`${range.start}T00:00:00Z`);
  const end = new Date(`${range.end}T00:00:00Z`);
  const durationMs = end.getTime() - start.getTime();
  return Math.floor(durationMs / 86_400_000) + 1;
}

function calendarSortStartDate(event: EventRecord): string {
  const range = readEventDateRange(event);
  return range?.start ?? "9999-12-31";
}

/**
 * Canonical calendar ordering for visible lanes and capsule rendering:
 * longer duration first, then earlier start date, then alphabetical name.
 */
export function compareCalendarEvents(a: EventRecord, b: EventRecord): number {
  const durationDiff = calendarDurationDays(b) - calendarDurationDays(a);
  if (durationDiff !== 0) return durationDiff;

  const startDateDiff = calendarSortStartDate(a).localeCompare(calendarSortStartDate(b));
  if (startDateDiff !== 0) return startDateDiff;

  const byName = (a.name ?? "").localeCompare(b.name ?? "", undefined, {
    sensitivity: "base",
  });
  if (byName !== 0) return byName;

  return a.id.localeCompare(b.id);
}
