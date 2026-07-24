import Link from "next/link";
import { Globe, MapPin } from "lucide-react";

import { Badge } from "@/src/components/common";
import type { PublicVenueSummary } from "@/src/features/events/server/mapPublicVenue";
import { resolveStorageLogoDisplayUrl } from "@/src/lib/storage/resolveStorageLogoDisplayUrl";
import { buildVenuePath } from "@/src/lib/routes/explorerUrls";

import { EditionSectionSurface } from "./EditionSectionSurface";

const venueCardClass =
  "rounded-xl border border-slate-200 bg-white p-8 shadow-sm lg:p-10";

const venueCardLinkClass = `${venueCardClass} block transition hover:border-brand-primary/40 hover:bg-brand-primary-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2`;

type EventVenueSectionProps = {
  venue: PublicVenueSummary;
  cityLabel: string;
  embedded?: boolean;
};

export function EventVenueSection({
  venue,
  cityLabel,
  embedded = false,
}: EventVenueSectionProps) {
  const logoUrl = resolveStorageLogoDisplayUrl(venue.logo_url) ?? "";
  const addressText = venue.address_text?.trim() ?? "";
  const hasLogo = logoUrl !== "";
  const venueHref =
    venue.archived_at == null
      ? buildVenuePath({ slug: venue.slug, id: venue.id })
      : null;

  const cardInner = (
    <div
      className={
        hasLogo
          ? "flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-0"
          : undefined
      }
    >
      {hasLogo ? (
        <>
          <div className="flex flex-[2] items-center justify-center px-2 py-4 lg:min-h-[15rem] lg:px-6 lg:py-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={`${venue.name} logo`}
              className="max-h-48 w-full max-w-[18rem] object-contain lg:max-h-56 lg:max-w-[20rem]"
            />
          </div>
          <div
            className="hidden w-px shrink-0 self-stretch bg-slate-200/40 lg:my-3 lg:block"
            aria-hidden="true"
          />
        </>
      ) : null}

      <div
        className={
          hasLogo
            ? "flex min-w-0 flex-[3] flex-col space-y-2 lg:justify-center lg:py-1 lg:pl-10"
            : "flex min-w-0 flex-1 flex-col space-y-2 lg:justify-center lg:py-1"
        }
      >
        <header className="flex flex-wrap items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Venue
          </h2>
          {venue.archived_at ? (
            <Badge variant="neutral">Historical venue record</Badge>
          ) : null}
        </header>

        <div className="space-y-10">
          <p className="text-2xl font-bold tracking-tight text-slate-900 lg:text-[2rem] lg:leading-[1.2]">
            {venue.name}
          </p>
          {cityLabel ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Globe
                aria-hidden="true"
                className="size-4 shrink-0 text-slate-400"
                strokeWidth={2}
              />
              <span>{cityLabel}</span>
            </p>
          ) : null}
        </div>

        {addressText !== "" ? (
          <div className="border-t border-slate-100 pt-6">
            <p className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-slate-400"
                strokeWidth={2}
              />
              <span className="whitespace-pre-wrap">{addressText}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <EditionSectionSurface embedded={embedded}>
      {venueHref ? (
        <Link
          href={venueHref}
          className={venueCardLinkClass}
          aria-label={`View venue ${venue.name}`}
        >
          {cardInner}
        </Link>
      ) : (
        <article className={venueCardClass}>{cardInner}</article>
      )}
    </EditionSectionSurface>
  );
}

type EventVenueEmptyStateProps = {
  cityLabel: string;
  embedded?: boolean;
};

export function EventVenueEmptyState({
  cityLabel,
  embedded = false,
}: EventVenueEmptyStateProps) {
  return (
    <EditionSectionSurface embedded={embedded}>
      <div className={venueCardClass}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Venue
        </h2>
        <p className="mt-6 text-base text-slate-700">
          Venue not specified for this event.
          {cityLabel ? ` City-level location: ${cityLabel}.` : ""}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Event location details may still appear on the Overview tab when a city is set.
        </p>
      </div>
    </EditionSectionSurface>
  );
}
