import Link from "next/link";

import {
  EventCard,
  type EventCardModel,
  type EventCardVariant,
} from "@/src/features/events/components/EventCard";
import type { DiscoverEditionSummary } from "@/src/features/home/server/getDiscoverHomeData";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

/** Matches Discover calendar empty-month strip (`px-4 py-3 text-center text-sm text-slate-600`). */
const compactListFooterClass = [
  "mt-auto block rounded-b-xl border-t border-slate-200 bg-white px-4 py-3",
  "text-center text-sm text-slate-600 transition",
  "hover:bg-slate-50 hover:text-brand-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2",
].join(" ");

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
        <Link href={footerHref} className={compactListFooterClass}>
          {footerLabel}
        </Link>
      ) : null}
    </div>
  );
}
