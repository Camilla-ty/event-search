import Link from "next/link";

import type { PublicVenueSummary } from "@/src/features/events/server/mapPublicVenue";
import { brandLinkClass } from "@/src/lib/design/classes";

import { buildPublicEditionTabHref } from "./publicEditionTabUrls";

type EventVenueOverviewSectionProps = {
  eventSlug: string;
  venue: PublicVenueSummary | null;
  cityLabel: string;
  hasVenueId: boolean;
};

export function EventVenueOverviewSection({
  eventSlug,
  venue,
  cityLabel,
  hasVenueId,
}: EventVenueOverviewSectionProps) {
  if (!venue && !hasVenueId) {
    return null;
  }

  const venueTabHref = buildPublicEditionTabHref(eventSlug, "venue");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Venue</h2>
        <Link href={venueTabHref} className={`text-sm ${brandLinkClass}`}>
          View venue
        </Link>
      </div>

      {venue ? (
        <div className="mt-3 space-y-1">
          <p className="font-medium text-slate-900">{venue.name}</p>
          {cityLabel !== "" ? (
            <p className="text-sm text-slate-600">{cityLabel}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Venue details are unavailable.</p>
      )}
    </section>
  );
}
