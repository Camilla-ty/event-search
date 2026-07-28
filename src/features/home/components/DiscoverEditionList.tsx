import Link from "next/link";

import {
  EventCard,
  type EventCardModel,
  type EventCardVariant,
} from "@/src/features/events/components/EventCard";
import type { DiscoverEditionSummary } from "@/src/features/home/server/getDiscoverHomeData";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

/** Typography + hover shared by Discover list footers (Upcoming + Recently Reviewed). */
const listFooterInteractionClass = [
  "text-center text-sm text-slate-600 transition",
  "hover:bg-slate-50 hover:text-brand-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2",
].join(" ");

/** Footer attached to the bottom of the compact Upcoming list card. */
const compactListFooterClass = [
  "mt-auto block rounded-b-xl border-t border-slate-200 bg-white px-4 py-3",
  listFooterInteractionClass,
].join(" ");

/**
 * Standalone footer below the full Recently Reviewed cards.
 * Same padding, typography, colours, and hover as the compact strip; full border
 * because it is not nested inside a shared list surface.
 */
const fullListFooterClass = [
  "block rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm",
  listFooterInteractionClass,
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
  const resolvedFooterHref = footerHref?.trim() ?? "";
  const resolvedFooterLabel = footerLabel?.trim() ?? "";
  const showFooter = resolvedFooterHref !== "" && resolvedFooterLabel !== "";

  const footerLink = showFooter ? (
    <Link
      href={resolvedFooterHref}
      className={variant === "compact" ? compactListFooterClass : fullListFooterClass}
    >
      {resolvedFooterLabel}
    </Link>
  ) : null;

  if (variant !== "compact") {
    return (
      <div className="space-y-3">
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
        {footerLink}
      </div>
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
      {footerLink}
    </div>
  );
}
