import type { CSSProperties } from "react";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import type { CalendarColorFamily } from "@/src/features/events/lib/eventCalendarColors";
import type { CalendarSegmentLayout, CalendarSegmentType } from "@/src/features/events/lib/eventCalendarSegments";

import {
  EventCalendarDayCell,
  type EventCalendarDayCellVariant,
} from "./EventCalendarDayCell";
import type { HiddenCalendarEvent } from "./EventCalendarHiddenEventsPopover";
import { EventCalendarEventChip } from "./EventCalendarEventChip";

type WeekRowCapsule = {
  event: EventRecord;
  eventId: string;
  lane: number;
  colorFamily: CalendarColorFamily;
  segmentType: CalendarSegmentType;
  startColumn: number;
  endColumn: number;
};

type MutableWeekRowCapsule = WeekRowCapsule & {
  startSegmentType: CalendarSegmentType;
  endSegmentType: CalendarSegmentType;
};

type EventCalendarWeekRowProps = {
  days: readonly string[];
  month: string;
  eventsByDay: ReadonlyMap<string, readonly EventRecord[]>;
  segmentsByDay: CalendarSegmentLayout["segmentsByDay"];
  variant: EventCalendarDayCellVariant;
};

const DEFAULT_VISIBLE_LANES = 3;

function isIsoDateInMonth(isoDate: string, month: string): boolean {
  return isoDate.startsWith(`${month}-`);
}

function resolveWeekRowCapsuleType(
  startSegmentType: CalendarSegmentType,
  endSegmentType: CalendarSegmentType,
): CalendarSegmentType {
  const hasVisibleStart = startSegmentType === "single" || startSegmentType === "start";
  const hasVisibleEnd = endSegmentType === "single" || endSegmentType === "end";

  if (hasVisibleStart && hasVisibleEnd) return "single";
  if (hasVisibleStart) return "start";
  if (hasVisibleEnd) return "end";
  return "middle";
}

function buildWeekRowCapsules(
  days: readonly string[],
  segmentsByDay: CalendarSegmentLayout["segmentsByDay"],
): WeekRowCapsule[] {
  const byEventId = new Map<string, MutableWeekRowCapsule>();

  for (let columnIndex = 0; columnIndex < days.length; columnIndex += 1) {
    const isoDate = days[columnIndex];
    const segments = segmentsByDay.get(isoDate) ?? [];

    for (const segment of segments) {
      const existing = byEventId.get(segment.eventId);
      if (existing) {
        existing.endColumn = columnIndex + 1;
        existing.endSegmentType = segment.segmentType;
        continue;
      }

      byEventId.set(segment.eventId, {
        event: segment.event,
        eventId: segment.eventId,
        lane: segment.lane,
        colorFamily: segment.colorFamily,
        segmentType: segment.segmentType,
        startColumn: columnIndex + 1,
        endColumn: columnIndex + 1,
        startSegmentType: segment.segmentType,
        endSegmentType: segment.segmentType,
      });
    }
  }

  return [...byEventId.values()]
    .map((capsule) => {
      return {
        ...capsule,
        segmentType: resolveWeekRowCapsuleType(
          capsule.startSegmentType,
          capsule.endSegmentType,
        ),
      };
    })
    .sort((a, b) => a.lane - b.lane);
}

function weekRowCapsuleStyle(capsule: WeekRowCapsule): CSSProperties {
  return {
    gridColumn: `${capsule.startColumn} / ${capsule.endColumn + 1}`,
    gridRow: String(capsule.lane + 1),
  };
}

function renderCapsuleRow(
  capsules: readonly WeekRowCapsule[],
  visibleLaneCount: number,
  hiddenClassName?: string,
) {
  return capsules
    .filter((capsule) => capsule.lane < visibleLaneCount)
    .map((capsule) => (
      <div
        key={`${capsule.eventId}-${visibleLaneCount}`}
        className={["pointer-events-auto", hiddenClassName].filter(Boolean).join(" ")}
        style={weekRowCapsuleStyle(capsule)}
      >
        <EventCalendarEventChip
          event={capsule.event}
          colorFamily={capsule.colorFamily}
          segmentType={capsule.segmentType}
        />
      </div>
    ));
}

export function EventCalendarWeekRow({
  days,
  month,
  eventsByDay,
  segmentsByDay,
  variant,
}: EventCalendarWeekRowProps) {
  const rowCapsules = buildWeekRowCapsules(days, segmentsByDay);

  return (
    <div className="relative">
      <div className="grid grid-cols-7">
        {days.map((isoDate) => {
          const daySegments = segmentsByDay.get(isoDate) ?? [];
          const defaultOverflowCount = daySegments.filter(
            (segment) => segment.lane >= DEFAULT_VISIBLE_LANES,
          ).length;
          const hiddenEvents: HiddenCalendarEvent[] = daySegments
            .filter((segment) => segment.lane >= DEFAULT_VISIBLE_LANES)
            .map((segment) => ({
              event: segment.event,
              colorFamily: segment.colorFamily,
            }));

          return (
            <EventCalendarDayCell
              key={isoDate}
              isoDate={isoDate}
              isCurrentMonth={isIsoDateInMonth(isoDate, month)}
              eventCount={(eventsByDay.get(isoDate) ?? []).length}
              overflowCount={defaultOverflowCount}
              hiddenEvents={hiddenEvents}
              variant={variant}
            />
          );
        })}
      </div>

      {variant === "compact" ? (
        <div className="pointer-events-none absolute inset-x-2 top-9 z-10 grid grid-cols-7 grid-rows-3 gap-y-1">
          {renderCapsuleRow(rowCapsules, DEFAULT_VISIBLE_LANES)}
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-2 top-9 z-10 grid grid-cols-7 grid-rows-3 gap-y-1">
          {renderCapsuleRow(rowCapsules, DEFAULT_VISIBLE_LANES)}
        </div>
      )}
    </div>
  );
}
