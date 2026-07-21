import {
  EventCard,
  type EventCardModel,
} from "@/src/features/events/components/EventCard";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

type DiscoverEditionListProps = {
  editions: PublicEditionSummary[];
};

export function mapDiscoverEditionToEventCardModel(
  edition: PublicEditionSummary,
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
  };
}

export function DiscoverEditionList({ editions }: DiscoverEditionListProps) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
      {editions.map((edition) => (
        <li key={edition.id}>
          <EventCard event={mapDiscoverEditionToEventCardModel(edition)} variant="compact" />
        </li>
      ))}
    </ul>
  );
}
