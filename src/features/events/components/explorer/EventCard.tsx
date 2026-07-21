"use client";

import {
  EventCard as SharedEventCard,
  type EventCardModel,
} from "@/src/features/events/components/EventCard";
import type { EventCardKeywordPreview } from "@/src/features/events/lib/eventCardKeywordPreview";
import type { EventExplorerRow } from "@/src/features/events/server/eventExplorerTypes";

function topicPreviewFromRow(event: EventExplorerRow): EventCardKeywordPreview | null {
  if (!event.keyword_preview) {
    return null;
  }

  return {
    visibleKeywords: event.keyword_preview.visible.map((label, index) => ({
      key: `${event.id}-kw-${index}`,
      label,
    })),
    overflowCount: event.keyword_preview.overflow_count,
  };
}

export function mapExplorerRowToEventCardModel(event: EventExplorerRow): EventCardModel {
  return {
    id: event.id,
    name: event.name,
    href: event.href || null,
    startDate: event.start_date,
    endDate: event.end_date,
    locationLabel: event.location_label,
    series: event.series,
    sponsorCount: event.sponsor_count,
    topicPreview: topicPreviewFromRow(event),
  };
}

export function EventCard({ event }: { event: EventExplorerRow }) {
  return <SharedEventCard event={mapExplorerRowToEventCardModel(event)} />;
}
