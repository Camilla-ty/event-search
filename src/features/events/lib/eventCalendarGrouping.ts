import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  readEventDateRange,
  readEventIsoDate,
} from "@/src/features/events/lib/readEventIsoDate";
import { parseEventExplorerMonth } from "@/src/lib/routes/explorerUrls";

export type MonthGridBounds = {
  month: string;
  monthStart: string;
  monthEnd: string;
  gridStart: string;
  gridEnd: string;
};

export type EventsByDay<T extends EventRecord = EventRecord> = ReadonlyMap<string, readonly T[]>;

function parseIsoParts(isoDate: string): { year: number; month: number; day: number } {
  return {
    year: Number(isoDate.slice(0, 4)),
    month: Number(isoDate.slice(5, 7)),
    day: Number(isoDate.slice(8, 10)),
  };
}

function formatIsoDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const { year, month, day } = parseIsoParts(isoDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDateUTC(date);
}

function getMondayBasedWeekday(isoDate: string): number {
  const { year, month, day } = parseIsoParts(isoDate);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

export function getMonthStartEnd(
  month: string,
): { monthStart: string; monthEnd: string } | null {
  const normalizedMonth = parseEventExplorerMonth(month);
  if (normalizedMonth === null) return null;

  const year = Number(normalizedMonth.slice(0, 4));
  const monthNumber = Number(normalizedMonth.slice(5, 7));
  const monthStart = `${normalizedMonth}-01`;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthEnd = `${normalizedMonth}-${String(lastDay).padStart(2, "0")}`;

  return { monthStart, monthEnd };
}

export function getMonthGridBounds(month: string): MonthGridBounds | null {
  const monthBounds = getMonthStartEnd(month);
  if (monthBounds === null) return null;

  const normalizedMonth = parseEventExplorerMonth(month);
  if (normalizedMonth === null) return null;

  const { monthStart, monthEnd } = monthBounds;
  const leadingDays = getMondayBasedWeekday(monthStart);
  const trailingDays = 6 - getMondayBasedWeekday(monthEnd);

  return {
    month: normalizedMonth,
    monthStart,
    monthEnd,
    gridStart: addDaysIso(monthStart, -leadingDays),
    gridEnd: addDaysIso(monthEnd, trailingDays),
  };
}

export function eventsIntersectMonth<T extends EventRecord>(
  events: readonly T[],
  month: string,
): T[] {
  const monthBounds = getMonthStartEnd(month);
  if (monthBounds === null) return [];

  const { monthStart, monthEnd } = monthBounds;

  return events.filter((event) => {
    const range = readEventDateRange(event);
    if (range === null) return false;
    return range.start <= monthEnd && range.end >= monthStart;
  });
}

export function groupEventsByDay<T extends EventRecord>(
  events: readonly T[],
  gridStart: string,
  gridEnd: string,
): EventsByDay<T> {
  const normalizedGridStart = readEventIsoDate(gridStart);
  const normalizedGridEnd = readEventIsoDate(gridEnd);
  if (normalizedGridStart === "" || normalizedGridEnd === "") {
    return new Map();
  }

  const groups = new Map<string, T[]>();

  for (const event of events) {
    const range = readEventDateRange(event);
    if (range === null) continue;

    const spanStart = range.start > normalizedGridStart ? range.start : normalizedGridStart;
    const spanEnd = range.end < normalizedGridEnd ? range.end : normalizedGridEnd;
    if (spanStart > spanEnd) continue;

    let cursor = spanStart;
    while (cursor <= spanEnd) {
      const bucket = groups.get(cursor) ?? [];
      bucket.push(event);
      groups.set(cursor, bucket);
      cursor = addDaysIso(cursor, 1);
    }
  }

  return groups;
}

export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addMonthsToMonthKey(month: string, delta: number): string | null {
  const normalizedMonth = parseEventExplorerMonth(month);
  if (normalizedMonth === null) return null;

  const year = Number(normalizedMonth.slice(0, 4));
  const monthNumber = Number(normalizedMonth.slice(5, 7));
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));

  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

export function formatCalendarMonthLabel(month: string): string {
  const normalizedMonth = parseEventExplorerMonth(month);
  if (normalizedMonth === null) return month;

  const year = Number(normalizedMonth.slice(0, 4));
  const monthNumber = Number(normalizedMonth.slice(5, 7));
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function listGridDays(gridStart: string, gridEnd: string): string[] {
  const normalizedGridStart = readEventIsoDate(gridStart);
  const normalizedGridEnd = readEventIsoDate(gridEnd);
  if (normalizedGridStart === "" || normalizedGridEnd === "") return [];

  const days: string[] = [];
  let cursor = normalizedGridStart;
  while (cursor <= normalizedGridEnd) {
    days.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return days;
}

export function isIsoDateInMonth(isoDate: string, month: string): boolean {
  const normalizedMonth = parseEventExplorerMonth(month);
  if (normalizedMonth === null) return false;
  return isoDate.startsWith(`${normalizedMonth}-`);
}
