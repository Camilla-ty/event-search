import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/src/components/common";
import { PublicBreadcrumbs } from "@/src/components/common/PublicBreadcrumbs";
import { EventOrganizersSection } from "@/src/features/events/components/detail/EventOrganizersSection";
import { EventOverviewSummarySection } from "@/src/features/events/components/detail/EventOverviewSummarySection";
import { EventSponsorsSection } from "@/src/features/events/components/detail/EventSponsorsSection";
import { ResearchInformationSection } from "@/src/features/events/components/detail/ResearchInformationSection";
import {
  EventVenueEmptyState,
  EventVenueSection,
} from "@/src/features/events/components/detail/EventVenueSection";
import { EditionSectionSurface } from "@/src/features/events/components/detail/EditionSectionSurface";
import { PublicEventEditionTabs } from "@/src/features/events/components/detail/PublicEventEditionTabs";
import { PublicTopicsSection } from "@/src/features/events/components/PublicTopicsSection";
import { RelatedEditionsSection } from "@/src/features/events/components/detail/RelatedEditionsSection";
import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import { filterDisplayableSponsors } from "@/src/features/events/components/detail/eventSponsorUtils";
import type { EventSponsorRow } from "@/src/features/events/components/detail/types";
import { formatEventDateRange } from "@/src/features/events/lib/formatEventDateRange";
import type { PublicEventSeriesSummary } from "@/src/features/events/types/publicEdition";
import { getEventDetailData } from "@/src/features/events/server/getEventDetailData";
import {
  editionHasVenueId,
  mapPublicVenueFromEditionRow,
} from "@/src/features/events/server/mapPublicVenue";
import { mapPublicOrganizersFromEditionRow } from "@/src/features/events/server/mapPublicOrganizers";
import { getRelatedEditions } from "@/src/features/events/server/getRelatedEditions";
import { getTotalSponsorCount } from "@/src/lib/queries/companies";
import { parseSponsorNoteType } from "@/src/features/events/lib/sponsorNoteType";
import { getPublicKeywordsForSeriesId } from "@/src/features/events/server/seriesKeywordsPublic";
import { mapPublicEventSeries } from "@/src/features/events/server/mapPublicEditionRow";
import { brandLinkClass } from "@/src/lib/design/classes";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { resolveSeriesDisplayLogo } from "@/src/lib/events/resolveSeriesDisplayLogo";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { buildSeriesHubPath } from "@/src/lib/routes/explorerUrls";
import { EventPartnerAlumniSection } from "@/src/features/partner-alumni/components/detail/EventPartnerAlumniSection";
import {
  getPublicPartnerAlumniForSeriesId,
  shouldShowPublicPartnerAlumniTab,
} from "@/src/features/partner-alumni/server/partnerAlumniPublic";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

function readSeriesId(
  edition: { series_id?: unknown; event_series?: unknown },
  series: PublicEventSeriesSummary | null,
): string | null {
  if (typeof edition.series_id === "string" && edition.series_id.trim() !== "") {
    return edition.series_id.trim();
  }
  return series?.id ?? null;
}

export async function generateMetadata({
  params,
}: EventDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const edition = await getEventDetailData(id);
  if (!edition) {
    return createPageMetadata({ title: "Event not found", path: `/events/${id}` });
  }
  const name = edition.name?.trim() || "Event";
  const location = formatLocationFromCityEmbed(edition.cities);
  const description = location
    ? `${name} — ${location}. View sponsors and event intelligence on EventPixels.`
    : `${name}. View sponsors and event intelligence on EventPixels.`;
  const slug = typeof edition.slug === "string" ? edition.slug : id;
  return createPageMetadata({
    title: name,
    description,
    path: `/events/${slug}`,
  });
}

export default async function EventDetailPage({
  params,
  searchParams,
}: EventDetailPageProps) {
  const { id } = await params;
  const { tab: requestedTab } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const edition = await getEventDetailData(id);

  if (!edition) {
    notFound();
  }

  const editionRecord = edition as Record<string, unknown>;
  const editionId =
    typeof edition.id === "string" && edition.id.trim() !== ""
      ? edition.id.trim()
      : null;
  const series = mapPublicEventSeries(edition.event_series);
  const seriesId = readSeriesId(edition, series);
  const seriesHubHref = series ? buildSeriesHubPath(series) : null;
  const eventSlug = typeof edition.slug === "string" ? edition.slug : id;

  const [relatedEditions, topics, totalSponsorCount, partnerAlumni] = await Promise.all([
    seriesId !== null && editionId !== null
      ? getRelatedEditions({
          seriesId,
          excludeEditionId: editionId,
        })
      : Promise.resolve([]),
    seriesId !== null
      ? getPublicKeywordsForSeriesId(seriesId)
      : Promise.resolve([]),
    editionId !== null ? getTotalSponsorCount(editionId) : Promise.resolve(0),
    seriesId !== null
      ? getPublicPartnerAlumniForSeriesId(seriesId)
      : Promise.resolve(null),
  ]);

  const showPartnerAlumniTab = shouldShowPublicPartnerAlumniTab(partnerAlumni);

  if (requestedTab === "partner-alumni" && !showPartnerAlumniTab) {
    redirect(`/events/${eventSlug || id}`);
  }

  const sponsors = filterDisplayableSponsors(
    (edition.event_sponsors ?? []) as EventSponsorRow[],
  );
  const isAuthenticated = user !== null;
  const cityLabel = formatLocationFromCityEmbed(edition.cities) || "";
  const venue = mapPublicVenueFromEditionRow(editionRecord);
  const organizers = mapPublicOrganizersFromEditionRow(editionRecord);
  const hasVenueId = editionHasVenueId(editionRecord);
  const seriesLogoUrl = resolveSeriesDisplayLogo(
    edition.event_series && typeof edition.event_series === "object"
      ? {
          logo_url:
            typeof edition.event_series.logo_url === "string"
              ? edition.event_series.logo_url
              : null,
        }
      : null,
  );

  const seriesBrandLabel = series?.name ?? null;
  const lastReviewedAt =
    typeof edition.last_reviewed_at === "string" ? edition.last_reviewed_at : null;
  const primarySourceUrl =
    typeof edition.primary_source_url === "string" ? edition.primary_source_url : null;
  const sponsorNoteType = parseSponsorNoteType(
    (edition as { sponsor_note_type?: unknown }).sponsor_note_type,
  );
  const lifecycleStatus = series?.lifecycle_status ?? null;
  const mergedIntoSeries = series?.merged_into_series ?? null;
  const eventDisplayName = edition.name?.trim() || "Event";

  return (
    <section className="space-y-6">
      <PublicBreadcrumbs
        items={[
          { label: "Events", href: "/events" },
          { label: eventDisplayName },
        ]}
      />

      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
          <div className="mx-auto shrink-0 md:mx-0">
            {seriesLogoUrl ? (
              <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                <SeriesLogo
                  series={{
                    name:
                      typeof edition.event_series?.name === "string"
                        ? edition.event_series.name
                        : null,
                    logo_url:
                      typeof edition.event_series?.logo_url === "string"
                        ? edition.event_series.logo_url
                        : null,
                  }}
                  fallbackName={typeof edition.name === "string" ? edition.name : null}
                  className="flex h-full w-full items-center justify-center"
                  imageClassName="max-h-full max-w-full object-contain"
                  monogramClassName="text-3xl font-semibold text-slate-400"
                />
              </div>
            ) : (
              <div className="h-40 w-40 rounded-xl bg-gradient-to-br from-brand-primary to-brand-primary-hover" />
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-2">
                {seriesBrandLabel && seriesHubHref ? (
                  <Link href={seriesHubHref}>
                    <Badge variant="neutral">{seriesBrandLabel}</Badge>
                  </Link>
                ) : (
                  <Badge variant="neutral">{seriesBrandLabel ?? "Event"}</Badge>
                )}
                <h1 className="text-2xl font-semibold text-slate-900">{edition.name}</h1>
                <p className="text-sm text-slate-600">{cityLabel || "Location not set"}</p>
                <p className="text-sm text-slate-500">
                  {formatEventDateRange(edition.start_date, edition.end_date)}
                </p>
              </div>
              <PublicTopicsSection topics={topics} layout="header" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Sponsors</p>
                <p className="text-lg font-semibold text-slate-900">{totalSponsorCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Year</p>
                <p className="text-lg font-semibold text-slate-900">{edition.year ?? "TBC"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Event brand</p>
                {seriesBrandLabel && seriesHubHref ? (
                  <Link
                    href={seriesHubHref}
                    className={`text-lg font-semibold ${brandLinkClass}`}
                  >
                    {seriesBrandLabel}
                  </Link>
                ) : (
                  <p className="text-lg font-semibold text-slate-900">Not set</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <PublicEventEditionTabs
          eventSlug={eventSlug}
          showPartnerAlumniTab={showPartnerAlumniTab}
          overviewPanel={
            <div className="space-y-6">
              <EventOverviewSummarySection
                eventSlug={eventSlug}
                lifecycleStatus={lifecycleStatus}
                mergedIntoSeries={mergedIntoSeries}
                venue={venue}
                hasVenueId={hasVenueId}
                sponsors={sponsors}
                totalSponsorCount={totalSponsorCount}
              />
              {seriesBrandLabel && seriesHubHref ? (
                <RelatedEditionsSection
                  seriesName={seriesBrandLabel}
                  seriesHubHref={seriesHubHref}
                  editions={relatedEditions}
                />
              ) : null}
              <ResearchInformationSection
                lastReviewedAt={lastReviewedAt}
                primarySourceUrl={primarySourceUrl}
              />
            </div>
          }
          sponsorsPanel={
            <EventSponsorsSection
              embedded
              sponsors={sponsors}
              isAuthenticated={isAuthenticated}
              totalSponsorCount={totalSponsorCount}
              sponsorNoteType={sponsorNoteType}
            />
          }
          venuePanel={
            venue ? (
              <EventVenueSection embedded venue={venue} cityLabel={cityLabel} />
            ) : hasVenueId ? (
              <EditionSectionSurface embedded>
                <h2 className="text-lg font-semibold text-slate-900">Venue</h2>
                <p className="mt-3 text-sm text-slate-600">Venue details are unavailable.</p>
              </EditionSectionSurface>
            ) : (
              <EventVenueEmptyState embedded cityLabel={cityLabel} />
            )
          }
          organizersPanel={<EventOrganizersSection embedded organizers={organizers} />}
          partnerAlumniPanel={
            partnerAlumni ? (
              <EventPartnerAlumniSection
                partnerAlumni={partnerAlumni}
                seriesName={seriesBrandLabel}
              />
            ) : null
          }
        />
      </Suspense>
    </section>
  );
}
