import type { EventRecord } from "@/src/features/events/components/explorer/types";
import type { MonthGridBounds } from "@/src/features/events/lib/eventCalendarGrouping";
import { addDaysIso, listGridDays } from "@/src/features/events/lib/eventCalendarGrouping";
import type {
  CalendarLaneAssignment,
  CalendarLaneLayout,
} from "@/src/features/events/lib/eventCalendarLanes";

export type CalendarColorFamily = "Blue" | "Green" | "Orange" | "Purple" | "Grey";

export type CalendarColorAssignment<T extends EventRecord = EventRecord> =
  CalendarLaneAssignment<T> & {
    colorFamily: CalendarColorFamily;
  };

export type CalendarColorLayout<T extends EventRecord = EventRecord> = {
  assignments: readonly CalendarColorAssignment<T>[];
  colorByEventId: ReadonlyMap<string, CalendarColorFamily>;
  assignmentsByDay: ReadonlyMap<string, readonly CalendarColorAssignment<T>[]>;
};

const PALETTE: readonly CalendarColorFamily[] = [
  "Blue",
  "Green",
  "Orange",
  "Purple",
  "Grey",
];

function stableHash(value: string): number {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function rangesOverlap(
  a: Pick<CalendarLaneAssignment, "visibleStart" | "visibleEnd">,
  b: Pick<CalendarLaneAssignment, "visibleStart" | "visibleEnd">,
): boolean {
  return a.visibleStart <= b.visibleEnd && b.visibleStart <= a.visibleEnd;
}

function buildDaysForAssignment(
  assignment: Pick<CalendarLaneAssignment, "visibleStart" | "visibleEnd">,
): string[] {
  const days: string[] = [];
  let cursor = assignment.visibleStart;
  while (cursor <= assignment.visibleEnd) {
    days.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return days;
}

function touchesHorizontally(
  a: CalendarLaneAssignment,
  b: CalendarLaneAssignment,
  gridDays: readonly string[],
  dayIndexByIsoDate: ReadonlyMap<string, number>,
): boolean {
  if (a.lane !== b.lane) return false;

  const bDays = new Set(buildDaysForAssignment(b));

  for (const day of buildDaysForAssignment(a)) {
    const dayIndex = dayIndexByIsoDate.get(day);
    if (dayIndex === undefined) continue;

    for (const neighborIndex of [dayIndex - 1, dayIndex + 1]) {
      const neighborDay = gridDays[neighborIndex];
      if (!neighborDay) continue;

      const sameWeekRow = Math.floor(dayIndex / 7) === Math.floor(neighborIndex / 7);
      if (sameWeekRow && bDays.has(neighborDay)) {
        return true;
      }
    }
  }

  return false;
}

function areAdjacent(
  a: CalendarLaneAssignment,
  b: CalendarLaneAssignment,
  gridDays: readonly string[],
  dayIndexByIsoDate: ReadonlyMap<string, number>,
): boolean {
  return rangesOverlap(a, b) || touchesHorizontally(a, b, gridDays, dayIndexByIsoDate);
}

export function buildCalendarColorLayout<T extends EventRecord>(
  laneLayout: CalendarLaneLayout<T>,
  bounds: MonthGridBounds,
): CalendarColorLayout<T> {
  const gridDays = listGridDays(bounds.gridStart, bounds.gridEnd);
  const dayIndexByIsoDate = new Map(gridDays.map((day, index) => [day, index]));

  const sortedAssignments = [...laneLayout.assignments].sort((a, b) => {
    const byStart = a.visibleStart.localeCompare(b.visibleStart);
    if (byStart !== 0) return byStart;

    const byEnd = a.visibleEnd.localeCompare(b.visibleEnd);
    if (byEnd !== 0) return byEnd;

    return a.eventId.localeCompare(b.eventId);
  });

  const assignments: CalendarColorAssignment<T>[] = [];
  const colorByEventId = new Map<string, CalendarColorFamily>();
  const assignmentsByDay = new Map<string, CalendarColorAssignment<T>[]>();

  for (const assignment of sortedAssignments) {
    const forbidden = new Set<CalendarColorFamily>();

    for (const existing of assignments) {
      if (areAdjacent(existing, assignment, gridDays, dayIndexByIsoDate)) {
        forbidden.add(existing.colorFamily);
      }
    }

    const colorFamily =
      PALETTE.find((color) => !forbidden.has(color)) ??
      PALETTE[stableHash(assignment.eventId) % PALETTE.length];

    const colorAssignment: CalendarColorAssignment<T> = {
      ...assignment,
      colorFamily,
    };

    assignments.push(colorAssignment);
    colorByEventId.set(colorAssignment.eventId, colorAssignment.colorFamily);

    for (const day of buildDaysForAssignment(colorAssignment)) {
      const bucket = assignmentsByDay.get(day) ?? [];
      bucket.push(colorAssignment);
      bucket.sort((a, b) => a.lane - b.lane);
      assignmentsByDay.set(day, bucket);
    }
  }

  return {
    assignments,
    colorByEventId,
    assignmentsByDay,
  };
}
