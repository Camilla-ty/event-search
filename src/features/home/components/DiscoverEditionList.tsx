import {
  EventCard,
  type EventCardModel,
  type EventCardVariant,
} from "@/src/features/events/components/EventCard";
import type { DiscoverEditionSummary } from "@/src/features/home/server/getDiscoverHomeData";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

type DiscoverEditionListProps = {
  editions: DiscoverEditionSummary[];
  variant: EventCardVariant;
};

export function mapDiscoverEditionToEventCardModel(
  edition: DiscoverEditionSummary,
): EventCardModel {
  return {
    id: edition.id,
    name: edition.name,
    href: buildEventDetailPath(edition),
    startDate: edition.start_date,
    endDate: edition.end_date,
    locationLabel: edition.locationLabel,
    series: edition.event_series,
    year: edition.year,
    sponsorCount: edition.sponsorCount,
    topicPreview: edition.topicPreview,
  };
}

export function DiscoverEditionList({ editions, variant }: DiscoverEditionListProps) {
  const listClassName =
    variant === "compact"
      ? "flex-1 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm"
      : "space-y-3";

  return (
    <ul className={listClassName}>
      {editions.map((edition) => (
        <li key={edition.id}>
          <EventCard
            event={mapDiscoverEditionToEventCardModel(edition)}
            variant={variant}
          />
        </li>
      ))}
    </ul>
  );
}
