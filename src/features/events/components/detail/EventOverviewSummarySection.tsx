import Link from "next/link";

import { Badge } from "@/src/components/common";
import type { BadgeProps } from "@/src/components/common/Badge";
import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { isCompanyRestricted } from "@/src/lib/companies/companyPublicRestriction";
import { resolveCompanyLogo } from "@/src/lib/companies/resolveCompanyLogo";
import {
  buildEventHistoryRows,
  type MergedIntoSeriesDestination,
} from "@/src/features/events/components/detail/eventHistoryDisplay";
import type { PublicOrganizerRow } from "@/src/features/events/server/mapPublicOrganizers";
import type { PublicVenueSummary } from "@/src/features/events/server/mapPublicVenue";
import { brandLinkClass } from "@/src/lib/design/classes";

import { EventStatusHelpPopover } from "./EventStatusHelpPopover";
import { MetadataRow } from "./MetadataRow";
import { PublicEditionInPageTabLink } from "./PublicEditionTabNavigation";
import type { EventSponsorRow } from "./types";

const SPONSOR_PREVIEW_LIMIT = 5;

/** Body-text link that shifts to brand colour on hover/focus (Overview tab jumps). */
const overviewTabTextLinkClass =
  "font-medium text-slate-900 transition hover:text-brand-primary focus-visible:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2";

type EventOverviewSummarySectionProps = {
  eventSlug: string;
  lifecycleStatus: string | null | undefined;
  mergedIntoSeries?: MergedIntoSeriesDestination | null;
  venue: PublicVenueSummary | null;
  hasVenueId: boolean;
  sponsors: EventSponsorRow[];
  totalSponsorCount: number;
  organizers?: PublicOrganizerRow[];
};

function statusBadgeVariant(value: string): BadgeProps["variant"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "active") return "success";
  if (normalized === "discontinued") return "warning";
  if (normalized === "merged") return "accent";
  return "neutral";
}

function previewLogoSponsors(sponsors: EventSponsorRow[]): EventSponsorRow[] {
  return sponsors
    .filter(
      (sponsor) => sponsor.companies && !isCompanyRestricted(sponsor.companies),
    )
    .slice(0, SPONSOR_PREVIEW_LIMIT);
}

function organizerDisplayNames(organizers: PublicOrganizerRow[]): string {
  const names: string[] = [];
  for (const organizer of organizers) {
    const name = organizer.company?.name?.trim();
    if (name) names.push(name);
  }
  return names.join(", ");
}

export function EventOverviewSummarySection({
  eventSlug,
  lifecycleStatus,
  mergedIntoSeries = null,
  venue,
  hasVenueId,
  sponsors,
  totalSponsorCount,
  organizers = [],
}: EventOverviewSummarySectionProps) {
  const historyRows = buildEventHistoryRows({
    lifecycleStatus,
    mergedIntoSeries,
  });
  const statusRow = historyRows?.find((row) => row.kind === "status");
  const mergedIntoRow = historyRows?.find((row) => row.kind === "merged_into");

  const showVenueRow = venue !== null || hasVenueId;
  const hasSponsorData = totalSponsorCount > 0 || sponsors.length > 0;
  const logoSponsors = previewLogoSponsors(sponsors);
  const showSponsorEllipsis = totalSponsorCount > logoSponsors.length;
  const organizerNames = organizerDisplayNames(organizers);
  const showOrganizersRow = organizerNames !== "";

  return (
    <section
      aria-label="Event summary"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <dl className="divide-y divide-slate-100">
        {statusRow ? (
          <div className="py-3 first:pt-0 last:pb-0">
            <MetadataRow label="Event Status" labelSuffix={<EventStatusHelpPopover />}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant={statusBadgeVariant(statusRow.value)}>{statusRow.value}</Badge>
                {mergedIntoRow ? (
                  <>
                    <span className="text-slate-500">into</span>
                    <Link href={mergedIntoRow.destinationHref} className={brandLinkClass}>
                      {mergedIntoRow.destinationName}
                    </Link>
                  </>
                ) : null}
              </div>
            </MetadataRow>
          </div>
        ) : null}

        {showVenueRow ? (
          <div className="py-3 first:pt-0 last:pb-0">
            <MetadataRow label="Venue">
              {venue ? (
                <PublicEditionInPageTabLink
                  eventSlug={eventSlug}
                  tab="venue"
                  className={overviewTabTextLinkClass}
                >
                  {venue.name}
                </PublicEditionInPageTabLink>
              ) : (
                <p>Venue details are unavailable.</p>
              )}
            </MetadataRow>
          </div>
        ) : null}

        <div className="py-3 first:pt-0 last:pb-0">
          <MetadataRow label="Sponsors">
            {hasSponsorData ? (
              <PublicEditionInPageTabLink
                eventSlug={eventSlug}
                tab="sponsors"
                aria-label={`View all ${totalSponsorCount.toLocaleString()} sponsors`}
                className="inline-flex flex-col items-start gap-1.5 rounded-lg transition hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
              >
                <span className="font-medium text-slate-900">
                  {totalSponsorCount.toLocaleString()}{" "}
                  {totalSponsorCount === 1 ? "sponsor" : "sponsors"}
                </span>
                {logoSponsors.length > 0 ? (
                  <span className="inline-flex flex-wrap items-center gap-3">
                    {logoSponsors.map((sponsor) => {
                      const company = sponsor.companies;
                      if (!company) return null;
                      const companyName = company.name?.trim() || "Sponsor";
                      const logoFields = companyLogoFieldsFromRow(company);
                      const accessibleLogoName = `${companyName} logo`;
                      const resolvedLogo = resolveCompanyLogo(logoFields);

                      return (
                        <span key={String(sponsor.id)} className="inline-flex">
                          <CompanyLogo
                            company={logoFields}
                            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white"
                            monogramClassName="text-sm font-semibold text-slate-400"
                            alt={accessibleLogoName}
                          />
                          {resolvedLogo.kind === "monogram" ? (
                            <span className="sr-only">{accessibleLogoName}</span>
                          ) : null}
                        </span>
                      );
                    })}
                    {showSponsorEllipsis ? (
                      <span aria-hidden="true" className="text-slate-500">
                        …
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </PublicEditionInPageTabLink>
            ) : (
              <p className="text-slate-500">Sponsor data not yet available.</p>
            )}
          </MetadataRow>
        </div>

        {showOrganizersRow ? (
          <div className="py-3 first:pt-0 last:pb-0">
            <MetadataRow label="Organizers">
              <PublicEditionInPageTabLink
                eventSlug={eventSlug}
                tab="organizers"
                className={overviewTabTextLinkClass}
              >
                {organizerNames}
              </PublicEditionInPageTabLink>
            </MetadataRow>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
