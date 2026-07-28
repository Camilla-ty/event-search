import Link from "next/link";

import {
  EventCard,
  type EventCardModel,
  type EventCardVariant,
} from "@/src/features/events/components/EventCard";
import type { DiscoverEditionSummary } from "@/src/features/home/server/getDiscoverHomeData";
import { brandLinkClass } from "@/src/lib/design/classes";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

type DiscoverEditionListProps = {
  editions: DiscoverEditionSummary[];
  variant: EventCardVariant;
  footerHref?: string;
  footerLabel?: string;
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

export function DiscoverEditionList({
  editions,
  variant,
  footerHref,
  footerLabel,
}: DiscoverEditionListProps) {
  const showFooter =
    variant === "compact" &&
    typeof footerHref === "string" &&
    footerHref.trim() !== "" &&
    typeof footerLabel === "string" &&
    footerLabel.trim() !== "";

  if (variant !== "compact") {
    return (
      <ul className="space-y-3">
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

  return (
    <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {editions.map((edition) => (
          <li key={edition.id}>
            <EventCard
              event={mapDiscoverEditionToEventCardModel(edition)}
              variant={variant}
            />
          </li>
        ))}
      </ul>
      {showFooter ? (
        <div className="mt-auto border-t border-slate-200 px-4 py-3">
          <Link href={footerHref} className={`text-sm ${brandLinkClass}`}>
            {footerLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
