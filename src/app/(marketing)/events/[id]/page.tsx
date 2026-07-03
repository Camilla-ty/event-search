import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/src/components/common";
import { EventSponsorsSection } from "@/src/features/events/components/detail/EventSponsorsSection";
import { EventHistorySection } from "@/src/features/events/components/detail/EventHistorySection";
import { ResearchInformationSection } from "@/src/features/events/components/detail/ResearchInformationSection";
import {
  EventVenueEmptyState,
  EventVenueSection,
} from "@/src/features/events/components/detail/EventVenueSection";
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
import { getRelatedEditions } from "@/src/features/events/server/getRelatedEditions";
import { getTotalSponsorCount } from "@/src/lib/queries/companies";
import { getPublicKeywordsForSeriesId } from "@/src/features/events/server/seriesKeywordsPublic";
import { mapPublicEventSeries } from "@/src/features/events/server/mapPublicEditionRow";
import { brandLinkClass, primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { resolveSeriesDisplayLogo } from "@/src/lib/events/resolveSeriesDisplayLogo";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { buildSeriesHubPath } from "@/src/lib/routes/explorerUrls";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
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

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;

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

  const [relatedEditions, topics, totalSponsorCount] = await Promise.all([
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
  ]);

  const sponsors = filterDisplayableSponsors(
    (edition.event_sponsors ?? []) as EventSponsorRow[],
  );
  const isAuthenticated = user !== null;
  const eventSlug = typeof edition.slug === "string" ? edition.slug : "";
  const cityLabel = formatLocationFromCityEmbed(edition.cities) || "";
  const venue = mapPublicVenueFromEditionRow(editionRecord);
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
  const lifecycleStatus = series?.lifecycle_status ?? null;
  const mergedIntoSeries = series?.merged_into_series ?? null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/events" className={`text-sm ${brandLinkClass}`}>
          ← Back to Events
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr] lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-brand-primary-muted">
          {seriesLogoUrl ? (
            <div className="aspect-[16/9] w-full p-8">
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
                monogramClassName="text-5xl font-semibold text-slate-400"
              />
            </div>
          ) : (
            <div className="aspect-[16/9] w-full bg-gradient-to-br from-brand-primary to-brand-primary-hover" />
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-2">
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
            <PublicTopicsSection topics={topics} />
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

      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <PublicEventEditionTabs
          eventSlug={eventSlug}
          overviewPanel={
            <div className="space-y-6">
              <EventHistorySection
                lifecycleStatus={lifecycleStatus}
                mergedIntoSeries={mergedIntoSeries}
              />
              <ResearchInformationSection
                lastReviewedAt={lastReviewedAt}
                primarySourceUrl={primarySourceUrl}
              />
              {seriesBrandLabel && seriesHubHref ? (
                <RelatedEditionsSection
                  seriesName={seriesBrandLabel}
                  seriesHubHref={seriesHubHref}
                  editions={relatedEditions}
                />
              ) : null}
            </div>
          }
          sponsorsPanel={
            <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <EventSponsorsSection
                sponsors={sponsors}
                isAuthenticated={isAuthenticated}
                eventSlug={eventSlug}
                totalSponsorCount={totalSponsorCount}
              />

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
                <div className="mt-3 space-y-2">
                  <Link
                    href={`/sponsors?event=${eventSlug}`}
                    className={`${primaryCtaClass} h-10 w-full`}
                  >
                    Search event sponsors
                  </Link>
                  {seriesHubHref ? (
                    <Link href={seriesHubHref} className={`${secondaryCtaClass} h-10 w-full`}>
                      View event brand
                    </Link>
                  ) : null}
                  <Link href="/events" className={`${secondaryCtaClass} h-10 w-full`}>
                    Back to Events
                  </Link>
                </div>
              </div>
            </section>
          }
          venuePanel={
            venue ? (
              <EventVenueSection venue={venue} cityLabel={cityLabel} />
            ) : hasVenueId ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Venue</h2>
                <p className="mt-3 text-sm text-slate-600">Venue details are unavailable.</p>
              </div>
            ) : (
              <EventVenueEmptyState cityLabel={cityLabel} />
            )
          }
        />
      </Suspense>
    </section>
  );
}
