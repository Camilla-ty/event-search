import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { buildEventCardKeywordPreview } from "@/src/features/events/lib/eventCardKeywordPreview";
import { formatLocationLabel } from "@/src/lib/location/formatLocationLabel";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

import type { EventExplorerRow } from "@/src/features/events/server/eventExplorerTypes";

export function mapEditionToEventExplorerRow(event: EventRecord): EventExplorerRow {
  const location_label = formatLocationLabel({
    city: event.cities?.name,
    state: event.cities?.states?.name,
    country: event.cities?.countries?.name,
  });
  const keywordPreview = buildEventCardKeywordPreview(event.series_keywords);
  const href = buildEventDetailPath(event) ?? `/events/${event.id}`;

  return {
    id: event.id,
    slug: event.slug?.trim() || event.id,
    name: event.name?.trim() || "Untitled Event",
    href,
    start_date: event.start_date ?? null,
    end_date: event.end_date ?? null,
    sponsor_count:
      typeof event.sponsor_count === "number"
        ? Math.max(0, Math.trunc(event.sponsor_count))
        : 0,
    location_label,
    series: event.event_series
      ? {
          name: event.event_series.name ?? null,
          logo_url: event.event_series.logo_url ?? null,
        }
      : null,
    keyword_preview: keywordPreview
      ? {
          visible: keywordPreview.visibleKeywords.map((keyword) => keyword.label),
          overflow_count: keywordPreview.overflowCount,
        }
      : null,
  };
}
