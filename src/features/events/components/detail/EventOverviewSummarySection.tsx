import Link from "next/link";

import { Badge } from "@/src/components/common";
import type { BadgeProps } from "@/src/components/common/Badge";
import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import {
  buildEventHistoryRows,
  type MergedIntoSeriesDestination,
} from "@/src/features/events/components/detail/eventHistoryDisplay";
import type { PublicVenueSummary } from "@/src/features/events/server/mapPublicVenue";
import { brandLinkClass } from "@/src/lib/design/classes";

import { EventStatusHelpPopover } from "./EventStatusHelpPopover";
import { MetadataRow } from "./MetadataRow";
import { buildPublicEditionTabHref } from "./publicEditionTabUrls";
import type { EventSponsorRow } from "./types";

const SPONSOR_PREVIEW_LIMIT = 5;

type EventOverviewSummarySectionProps = {
  eventSlug: string;
  lifecycleStatus: string | null | undefined;
  mergedIntoSeries?: MergedIntoSeriesDestination | null;
  venue: PublicVenueSummary | null;
  hasVenueId: boolean;
  sponsors: EventSponsorRow[];
  totalSponsorCount: number;
};

function statusBadgeVariant(value: string): BadgeProps["variant"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "active") return "success";
  if (normalized === "discontinued") return "warning";
  if (normalized === "merged") return "accent";
  return "neutral";
}

export function EventOverviewSummarySection({
  eventSlug,
  lifecycleStatus,
  mergedIntoSeries = null,
  venue,
  hasVenueId,
  sponsors,
  totalSponsorCount,
}: EventOverviewSummarySectionProps) {
  const historyRows = buildEventHistoryRows({
    lifecycleStatus,
    mergedIntoSeries,
  });
  const statusRow = historyRows?.find((row) => row.kind === "status");
  const mergedIntoRow = historyRows?.find((row) => row.kind === "merged_into");

  const showVenueRow = venue !== null || hasVenueId;
  const hasSponsorData = totalSponsorCount > 0 || sponsors.length > 0;
  const previewSponsors = sponsors.slice(0, SPONSOR_PREVIEW_LIMIT);
  const overflowCount = Math.max(0, totalSponsorCount - previewSponsors.length);
  const venueTabHref = buildPublicEditionTabHref(eventSlug, "venue");
  const sponsorsTabHref = buildPublicEditionTabHref(eventSlug, "sponsors");

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
                <Link href={venueTabHref} className={`font-medium ${brandLinkClass}`}>
                  {venue.name}
                </Link>
              ) : (
                <p>Venue details are unavailable.</p>
              )}
            </MetadataRow>
          </div>
        ) : null}

        <div className="py-3 first:pt-0 last:pb-0">
          <MetadataRow label="Sponsors">
            {hasSponsorData ? (
              previewSponsors.length > 0 ? (
                <Link
                  href={sponsorsTabHref}
                  aria-label={`View all ${totalSponsorCount.toLocaleString()} sponsors`}
                  className="inline-flex flex-wrap items-center gap-3 rounded-lg transition hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
                >
                  {previewSponsors.map((sponsor) => {
                    const company = sponsor.companies;

                    if (!company) {
                      return null;
                    }

                    return (
                      <CompanyLogo
                        key={String(sponsor.id)}
                        company={companyLogoFieldsFromRow(company)}
                        className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white"
                        monogramClassName="text-sm font-semibold text-slate-400"
                        alt=""
                      />
                    );
                  })}
                  {overflowCount > 0 ? (
                    <Badge
                      variant="neutral"
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    >
                      +{overflowCount.toLocaleString()}
                    </Badge>
                  ) : null}
                </Link>
              ) : (
                <p className="text-slate-500">Sponsor data not yet available.</p>
              )
            ) : (
              <p className="text-slate-500">Sponsor data not yet available.</p>
            )}
          </MetadataRow>
        </div>
      </dl>
    </section>
  );
}
