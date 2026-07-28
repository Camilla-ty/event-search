import type {
  CalendarColorAssignment,
  CalendarColorLayout,
} from "@/src/features/events/lib/eventCalendarColors";
import type { MonthGridBounds } from "@/src/features/events/lib/eventCalendarGrouping";
import { listGridDays } from "@/src/features/events/lib/eventCalendarGrouping";

export type CalendarSegmentType = "single" | "start" | "middle" | "end";

export type CalendarSegment = CalendarColorAssignment & {
  segmentType: CalendarSegmentType;
};

export type CalendarSegmentLayout = {
  segmentsByDay: ReadonlyMap<string, readonly CalendarSegment[]>;
};

function includesDay(
  assignment: Pick<CalendarColorAssignment, "visibleStart" | "visibleEnd">,
  isoDate: string | undefined,
): boolean {
  if (!isoDate) return false;
  return assignment.visibleStart <= isoDate && isoDate <= assignment.visibleEnd;
}

function resolveSegmentType(hasPrev: boolean, hasNext: boolean): CalendarSegmentType {
  if (hasPrev && hasNext) return "middle";
  if (hasPrev) return "end";
  if (hasNext) return "start";
  return "single";
}

export function buildCalendarSegmentLayout(
  colorLayout: CalendarColorLayout,
  bounds: MonthGridBounds,
): CalendarSegmentLayout {
  const gridDays = listGridDays(bounds.gridStart, bounds.gridEnd);
  const segmentsByDay = new Map<string, CalendarSegment[]>();

  for (const assignment of colorLayout.assignments) {
    for (let dayIndex = 0; dayIndex < gridDays.length; dayIndex += 1) {
      const isoDate = gridDays[dayIndex];
      if (!includesDay(assignment, isoDate)) continue;

      const previousDay = gridDays[dayIndex - 1];
      const nextDay = gridDays[dayIndex + 1];

      const hasPrev = includesDay(assignment, previousDay);
      const hasNext = includesDay(assignment, nextDay);

      const bucket = segmentsByDay.get(isoDate) ?? [];
      bucket.push({
        ...assignment,
        segmentType: resolveSegmentType(hasPrev, hasNext),
      });
      bucket.sort((a, b) => a.lane - b.lane);
      segmentsByDay.set(isoDate, bucket);
    }
  }

  return { segmentsByDay };
}
