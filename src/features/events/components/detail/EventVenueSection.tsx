import { Badge } from "@/src/components/common";
import type { PublicVenueSummary } from "@/src/features/events/server/mapPublicVenue";
import { buildVenueGoogleMapsUrl } from "@/src/features/venues/lib/buildGoogleMapsUrl";
import { brandLinkClass } from "@/src/lib/design/classes";

type EventVenueSectionProps = {
  venue: PublicVenueSummary;
  cityLabel: string;
};

export function EventVenueSection({ venue, cityLabel }: EventVenueSectionProps) {
  const mapUrl = buildVenueGoogleMapsUrl({
    name: venue.name,
    addressText: venue.address_text,
    cityLabel,
  });
  const logoUrl = venue.logo_url?.trim() ?? "";
  const websiteUrl = venue.website_url?.trim() ?? "";
  const addressText = venue.address_text?.trim() ?? "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Venue</h2>
          {venue.archived_at ? (
            <Badge variant="neutral">Historical venue record</Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
        {logoUrl !== "" ? (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={`${venue.name} logo`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xl font-semibold text-slate-900">{venue.name}</p>
            {cityLabel ? <p className="mt-1 text-sm text-slate-600">{cityLabel}</p> : null}
          </div>

          {addressText !== "" ? (
            <p className="whitespace-pre-wrap text-sm text-slate-700">{addressText}</p>
          ) : null}

          <div className="flex flex-wrap gap-4 text-sm">
            {websiteUrl !== "" ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={brandLinkClass}
              >
                Visit website ↗
              </a>
            ) : null}
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={brandLinkClass}
              >
                View map ↗
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type EventVenueEmptyStateProps = {
  cityLabel: string;
};

export function EventVenueEmptyState({ cityLabel }: EventVenueEmptyStateProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Venue</h2>
      <p className="mt-3 text-sm text-slate-600">
        Venue not specified for this edition.
        {cityLabel ? ` City-level location: ${cityLabel}.` : ""}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Event location details may still appear on the Overview tab when a city is set.
      </p>
    </div>
  );
}
