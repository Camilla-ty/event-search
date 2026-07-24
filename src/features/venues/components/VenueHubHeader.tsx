import { Globe, MapPin } from "lucide-react";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { FactualSummaryParagraph } from "@/src/components/seo/FactualSummaryParagraph";
import type { PublicVenueHub } from "@/src/features/venues/server/getVenueHubData";
import { buildVenueGoogleMapsUrl } from "@/src/features/venues/lib/buildGoogleMapsUrl";
import { formatPublicCompanyWebsite } from "@/src/lib/domain/formatPublicCompanyWebsite";

type VenueHubHeaderProps = {
  venue: PublicVenueHub;
  factualSummary?: string | null;
};

const venueMetaLinkClass =
  "text-slate-600 transition hover:text-brand-primary focus-visible:outline-none focus-visible:text-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2";

export function VenueHubHeader({
  venue,
  factualSummary = null,
}: VenueHubHeaderProps) {
  const websiteDisplay = formatPublicCompanyWebsite({
    website: venue.website_url,
    domain: null,
  });
  const addressText = venue.address_text?.trim() ?? "";
  const mapUrl =
    addressText !== ""
      ? buildVenueGoogleMapsUrl({
          name: venue.name,
          addressText: venue.address_text,
          cityLabel: venue.locationLabel,
        })
      : null;

  return (
    <header className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[auto_1fr] md:items-start lg:gap-10 lg:p-10">
      <CompanyLogo
        company={{
          name: venue.name,
          logo_url: venue.logo_url,
          domain: null,
          logo_source: null,
          logo_status: null,
        }}
        alt={`${venue.name} logo`}
        className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:h-32 lg:w-32"
        imageClassName="max-h-full max-w-full object-contain p-2"
        monogramClassName="text-2xl font-semibold text-slate-400"
      />

      <div className="flex min-w-0 flex-col">
        <div className="space-y-2">
          {venue.locationLabel ? (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {venue.locationLabel}
            </p>
          ) : null}

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-[2rem] lg:leading-[1.2]">
            {venue.name}
          </h1>

          {factualSummary ? (
            <FactualSummaryParagraph
              summary={factualSummary}
              className="pt-1 text-sm leading-relaxed text-slate-700"
            />
          ) : (
            <p className="pt-1 text-sm text-slate-500">
              Venue on EventPixels — browse events held here below.
            </p>
          )}
        </div>

        {addressText !== "" || websiteDisplay ? (
          <div className="mt-6 space-y-3 border-t border-slate-100 pt-6">
            {addressText !== "" ? (
              mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-2.5 text-sm leading-relaxed ${venueMetaLinkClass}`}
                >
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-slate-400"
                    strokeWidth={2}
                  />
                  <span className="whitespace-pre-wrap">{addressText}</span>
                </a>
              ) : (
                <p className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-slate-400"
                    strokeWidth={2}
                  />
                  <span className="whitespace-pre-wrap">{addressText}</span>
                </p>
              )
            ) : null}

            {websiteDisplay ? (
              <p className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
                <Globe
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-slate-400"
                  strokeWidth={2}
                />
                <a
                  href={websiteDisplay.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={venueMetaLinkClass}
                >
                  {websiteDisplay.label}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
