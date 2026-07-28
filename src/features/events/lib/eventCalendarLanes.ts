import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { addDaysIso } from "@/src/features/events/lib/eventCalendarGrouping";
import type { MonthGridBounds } from "@/src/features/events/lib/eventCalendarGrouping";
import { compareCalendarEvents } from "@/src/features/events/lib/eventCalendarOrdering";
import { readEventDateRange } from "@/src/features/events/lib/readEventIsoDate";

export type CalendarLaneAssignment<T extends EventRecord = EventRecord> = {
  event: T;
  eventId: string;
  lane: number;
  visibleStart: string;
  visibleEnd: string;
};

export type CalendarLaneLayout<T extends EventRecord = EventRecord> = {
  assignments: readonly CalendarLaneAssignment<T>[];
  assignmentsByEventId: ReadonlyMap<string, CalendarLaneAssignment<T>>;
  assignmentsByDay: ReadonlyMap<string, readonly CalendarLaneAssignment<T>[]>;
  laneCount: number;
};

function overlapsVisibleRange(
  a: Pick<CalendarLaneAssignment, "visibleStart" | "visibleEnd">,
  b: Pick<CalendarLaneAssignment, "visibleStart" | "visibleEnd">,
): boolean {
  return a.visibleStart <= b.visibleEnd && b.visibleStart <= a.visibleEnd;
}

function clipEventToVisibleGrid<T extends EventRecord>(
  event: T,
  bounds: MonthGridBounds,
): CalendarLaneAssignment<T> | null {
  const range = readEventDateRange(event);
  if (range === null) return null;
  if (range.start > bounds.monthEnd || range.end < bounds.monthStart) return null;

  return {
    event,
    eventId: event.id,
    lane: -1,
    visibleStart: range.start > bounds.gridStart ? range.start : bounds.gridStart,
    visibleEnd: range.end < bounds.gridEnd ? range.end : bounds.gridEnd,
  };
}

export function buildCalendarLaneLayout<T extends EventRecord>(
  events: readonly T[],
  bounds: MonthGridBounds,
): CalendarLaneLayout<T> {
  const visibleAssignments = events
    .map((event) => clipEventToVisibleGrid(event, bounds))
    .filter((assignment): assignment is CalendarLaneAssignment<T> => assignment !== null)
    .sort((a, b) => compareCalendarEvents(a.event, b.event));

  const assignments: CalendarLaneAssignment<T>[] = [];

  for (const assignment of visibleAssignments) {
    let lane = 0;

    while (
      assignments.some(
        (existing) => existing.lane === lane && overlapsVisibleRange(existing, assignment),
      )
    ) {
      lane += 1;
    }

    assignments.push({ ...assignment, lane });
  }

  const assignmentsByEventId = new Map<string, CalendarLaneAssignment<T>>();
  const assignmentsByDay = new Map<string, CalendarLaneAssignment<T>[]>();

  for (const assignment of assignments) {
    assignmentsByEventId.set(assignment.eventId, assignment);

    let cursor = assignment.visibleStart;
    while (cursor <= assignment.visibleEnd) {
      const bucket = assignmentsByDay.get(cursor) ?? [];
      bucket.push(assignment);
      bucket.sort((a, b) => a.lane - b.lane);
      assignmentsByDay.set(cursor, bucket);
      cursor = addDaysIso(cursor, 1);
    }
  }

  const laneCount = assignments.reduce(
    (maxLane, assignment) => Math.max(maxLane, assignment.lane + 1),
    0,
  );

  return {
    assignments,
    assignmentsByEventId,
    assignmentsByDay,
    laneCount,
  };
}
