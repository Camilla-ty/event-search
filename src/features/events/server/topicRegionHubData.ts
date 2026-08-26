/**
 * Generic Topic × Region hub data loader.
 * Shared by the public hub routes, the Admin preview, and sitemap inclusion.
 * Returns computed data regardless of the quality gate; callers decide how to
 * treat `passesGate`.
 */

import {
  buildTopicRegionHubMetaDescription,
  buildTopicRegionHubSummary,
  buildTopicRegionHubTitle,
  formatTopicRegionHubLastReviewed,
  topicRegionHubPassesGate,
  TOPIC_REGION_HUB_SPONSOR_DISPLAY_LIMIT,
  type TopicRegionHubFacts,
} from "@/src/features/events/lib/topicRegionHub";
import { mapKeywordRow } from "@/src/features/events/server/mapKeywordRow";
import { readSeriesIdsFromKeywordLinks } from "@/src/features/events/server/topicHubPublic";
import { formatPublicEventDateRange } from "@/src/lib/date/formatPublicEventDateRange";
import { formatLocationLabel } from "@/src/lib/location/formatLocationLabel";
import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";
import {
  getSponsorCountsByEditionIds,
  readSponsorCountForEdition,
} from "@/src/lib/queries/companies";
import { fetchAllByIdInBatches } from "@/src/lib/supabase/fetchInBatches";
import { createClient } from "@/src/lib/supabase/server";
import { mapPublicLogoUrl } from "@/src/lib/storage/mapPublicLogoUrl";
import { formatResearchPagePublicPath } from "@/src/features/research-pages/lib/formatResearchPagePublicPath";
import type { ResearchPageLocation } from "@/src/features/research-pages/lib/researchPageLocation";
import { buildPublicCompanyRoleHref } from "@/src/lib/companies/eventBrandPublicDestinationIndex";
import { getEventBrandPublicDestinationIndex } from "@/src/lib/companies/eventBrandPublicDestinationIndex.server";

export type TopicRegionHubEventCard = {
  id: string;
  slug: string;
  name: string;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
  dateLabel: string | null;
  locationLabel: string;
  countryName: string;
  seriesName: string | null;
  seriesSlug: string | null;
  sponsorCount: number;
  lastReviewedAt: string | null;
  lastReviewedLabel: string | null;
};

export type TopicRegionHubSponsorRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  hubEventCount: number;
  globalEditionCount: number;
  /** ADR-005 EB4: resolved public Company destination. */
  publicHref: string | null;
};

export type TopicRegionHubPageData = {
  path: string;
  title: string;
  metaDescription: string;
  h1: string;
  eyebrow: string;
  topicName: string;
  locationType: ResearchPageLocation["type"];
  locationName: string;
  summary: string | null;
  lastReviewedAt: string | null;
  lastReviewedLabel: string | null;
  facts: TopicRegionHubFacts;
  events: TopicRegionHubEventCard[];
  sponsors: TopicRegionHubSponsorRow[];
  totalSponsorCount: number;
  topicHubPath: string;
  passesGate: boolean;
};

type EditionRaw = {
  id: string;
  slug: string;
  name: string;
  year: number | null;
  start_date: string | null;
  end_date: string | null;
  last_reviewed_at: string | null;
  series_id: string;
  seriesName: string | null;
  seriesSlug: string | null;
  locationLabel: string;
  countryName: string;
  regionSlug: string | null;
  countrySlug: string | null;
};

function readNestedRecord(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (row === null || typeof row !== "object") return null;
  return row as Record<string, unknown>;
}

function readString(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

function readYear(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function mapEditionRaw(raw: unknown): EditionRaw | null {
  if (raw === null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = readString(row.id);
  const slug = readString(row.slug);
  const name = readString(row.name);
  if (!id || !slug || !name) return null;

  const series = readNestedRecord(row.event_series);
  const cities = readNestedRecord(row.cities);
  const countries = readNestedRecord(cities?.countries);
  const regions = readNestedRecord(countries?.regions);

  const cityName = readString(cities?.name);
  const countryName = readString(countries?.name) ?? "";
  const stateName = readString(readNestedRecord(cities?.states)?.name);

  return {
    id,
    slug,
    name,
    year: readYear(row.year),
    start_date: readString(row.start_date),
    end_date: readString(row.end_date),
    last_reviewed_at: readString(row.last_reviewed_at),
    series_id: readString(row.series_id) ?? readString(series?.id) ?? "",
    seriesName: readString(series?.name),
    seriesSlug: readString(series?.slug),
    locationLabel: formatLocationLabel({
      city: cityName,
      state: stateName,
      country: countryName || null,
    }),
    countryName,
    regionSlug: readString(regions?.slug),
    countrySlug: readString(countries?.slug),
  };
}

function sortHubEditions(editions: readonly EditionRaw[]): EditionRaw[] {
  return editions.slice().sort((a, b) => {
    const startA = a.start_date ?? "";
    const startB = b.start_date ?? "";
    if (startA !== "" || startB !== "") {
      if (startA === "") return 1;
      if (startB === "") return -1;
      if (startA !== startB) return startB.localeCompare(startA);
    }
    const yearA = a.year ?? -1;
    const yearB = b.year ?? -1;
    if (yearA !== yearB) return yearB - yearA;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function maxLastReviewedAt(values: readonly (string | null)[]): string | null {
  let max: string | null = null;
  for (const value of values) {
    if (value === null) continue;
    if (max === null || value > max) max = value;
  }
  return max;
}

/**
 * Generic Topic × Location hub data loader, where Location is a Region or a Country.
 * Returns computed data even when the indexability gate fails.
 * Returns null only when the topic/location combination has no data at all
 * (missing keyword, missing location, no linked series, or no editions there).
 *
 * @param year - When set, editions are filtered at the DB with `.eq("year", year)`.
 *   When null/omitted, all years are included (existing behaviour).
 */
export async function getTopicRegionHubPageData(
  topicSlug: string,
  location: ResearchPageLocation,
  year: number | null = null,
): Promise<TopicRegionHubPageData | null> {
  const supabase = await createClient();

  const keywordResult = await supabase
    .from("keyword")
    .select("id, name, slug")
    .eq("slug", topicSlug)
    .maybeSingle();
  if (keywordResult.error) throw new Error(keywordResult.error.message);
  const topic = mapKeywordRow(keywordResult.data);
  if (!topic) return null;

  const locationTable = location.type === "country" ? "countries" : "regions";
  const locationResult = await supabase
    .from(locationTable)
    .select("id, name, slug")
    .eq("slug", location.slug)
    .maybeSingle();
  if (locationResult.error) throw new Error(locationResult.error.message);
  const locationRow = locationResult.data as
    | { id: string; name: string; slug: string }
    | null;
  if (!locationRow) return null;

  const seriesLinksResult = await supabase
    .from("event_series_keyword")
    .select("series_id")
    .eq("keyword_id", topic.id);
  if (seriesLinksResult.error) throw new Error(seriesLinksResult.error.message);
  const seriesIds = readSeriesIdsFromKeywordLinks(seriesLinksResult.data ?? []);
  if (seriesIds.length === 0) return null;

  let editionsQuery = supabase
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .in("series_id", seriesIds);

  if (year !== null) {
    editionsQuery = editionsQuery.eq("year", year);
  }

  const editionsResult = await editionsQuery;

  if (editionsResult.error) throw new Error(editionsResult.error.message);

  const locationEditions = sortHubEditions(
    (editionsResult.data ?? [])
      .map(mapEditionRaw)
      .filter((edition): edition is EditionRaw => edition !== null)
      .filter((edition) =>
        location.type === "country"
          ? edition.countrySlug === location.slug
          : edition.regionSlug === location.slug,
      ),
  );

  if (locationEditions.length === 0) return null;

  const editionIds = locationEditions.map((edition) => edition.id);
  const sponsorCounts = await getSponsorCountsByEditionIds(editionIds);

  const eventCards: TopicRegionHubEventCard[] = locationEditions.map((edition) => {
    const sponsorCount = readSponsorCountForEdition(sponsorCounts, edition.id);
    return {
      id: edition.id,
      slug: edition.slug,
      name: edition.name,
      year: edition.year,
      startDate: edition.start_date,
      endDate: edition.end_date,
      dateLabel: formatPublicEventDateRange(edition.start_date, edition.end_date),
      locationLabel: edition.locationLabel,
      countryName: edition.countryName,
      seriesName: edition.seriesName,
      seriesSlug: edition.seriesSlug,
      sponsorCount,
      lastReviewedAt: edition.last_reviewed_at,
      lastReviewedLabel: formatTopicRegionHubLastReviewed(edition.last_reviewed_at),
    };
  });

  const indexableEventCount = eventCards.filter((event) => event.sponsorCount >= 1).length;
  const seriesIdSet = new Set(
    locationEditions.map((edition) => edition.series_id).filter((id) => id !== ""),
  );
  const years = eventCards
    .map((event) => event.year)
    .filter((year): year is number => year !== null);
  const yearMin = years.length > 0 ? Math.min(...years) : null;
  const yearMax = years.length > 0 ? Math.max(...years) : null;
  const countryNames = [
    ...new Set(
      eventCards
        .map((event) => event.countryName.trim())
        .filter((name) => name !== ""),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const sponsorLinks = await fetchAllByIdInBatches<{
    company_id: string | null;
    event_editions_id: string | null;
  }>(editionIds, async (batchIds) => {
    const result = await supabase
      .from("event_edition_sponsor_companies")
      .select("company_id, event_editions_id")
      .in("event_editions_id", batchIds);
    return {
      data: (result.data ?? null) as {
        company_id: string | null;
        event_editions_id: string | null;
      }[] | null,
      error: result.error,
    };
  });

  const hubEditionIdsByCompany = new Map<string, Set<string>>();
  for (const link of sponsorLinks) {
    const companyId = typeof link.company_id === "string" ? link.company_id.trim() : "";
    const editionId =
      typeof link.event_editions_id === "string" ? link.event_editions_id.trim() : "";
    if (companyId === "" || editionId === "") continue;
    const set = hubEditionIdsByCompany.get(companyId) ?? new Set<string>();
    set.add(editionId.toLowerCase());
    hubEditionIdsByCompany.set(companyId, set);
  }

  const companyIds = [...hubEditionIdsByCompany.keys()];
  const [companyRows, destinationIndex, statsRows] = await Promise.all([
    fetchAllByIdInBatches<{
      id: string;
      name: string;
      slug: string;
      domain: string | null;
      logo_url: string | null;
      restricted_at: string | null;
      event_brand_public_profile_approved_at: string | null;
    }>(companyIds, async (batchIds) => {
      const result = await supabase
        .from("companies")
        .select(
          "id, name, slug, domain, logo_url, restricted_at, event_brand_public_profile_approved_at",
        )
        .in("id", batchIds)
        .is("restricted_at", null);
      return {
        data: (result.data ?? null) as {
          id: string;
          name: string;
          slug: string;
          domain: string | null;
          logo_url: string | null;
          restricted_at: string | null;
          event_brand_public_profile_approved_at: string | null;
        }[] | null,
        error: result.error,
      };
    }),
    getEventBrandPublicDestinationIndex(),
    fetchAllByIdInBatches<{
      company_id: string;
      sponsored_edition_count: number | null;
    }>(companyIds, async (batchIds) => {
      const result = await supabase
        .from("company_sponsor_stats")
        .select("company_id, sponsored_edition_count")
        .in("company_id", batchIds);
      return {
        data: (result.data ?? null) as {
          company_id: string;
          sponsored_edition_count: number | null;
        }[] | null,
        error: result.error,
      };
    }),
  ]);

  const globalCountByCompany = new Map<string, number>();
  for (const row of statsRows) {
    const id = typeof row.company_id === "string" ? row.company_id.trim() : "";
    if (id === "") continue;
    const count =
      typeof row.sponsored_edition_count === "number" &&
      Number.isFinite(row.sponsored_edition_count)
        ? Math.max(0, Math.trunc(row.sponsored_edition_count))
        : 0;
    globalCountByCompany.set(id, count);
  }

  const sponsors: TopicRegionHubSponsorRow[] = companyRows
    .map((company) => {
      const hubEventCount = hubEditionIdsByCompany.get(company.id)?.size ?? 0;
      if (hubEventCount < 1) return null;
      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        domain: company.domain,
        logoUrl: mapPublicLogoUrl(company.logo_url),
        hubEventCount,
        globalEditionCount: globalCountByCompany.get(company.id) ?? 0,
        publicHref: buildPublicCompanyRoleHref(
          {
            id: company.id,
            slug: company.slug,
            restricted_at: company.restricted_at,
            event_brand_public_profile_approved_at:
              company.event_brand_public_profile_approved_at,
          },
          destinationIndex,
        ),
      };
    })
    .filter((row): row is TopicRegionHubSponsorRow => row !== null)
    .sort((a, b) => {
      if (a.hubEventCount !== b.hubEventCount) return b.hubEventCount - a.hubEventCount;
      if (a.globalEditionCount !== b.globalEditionCount) {
        return b.globalEditionCount - a.globalEditionCount;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  const distinctSponsorCount = sponsors.length;

  const passesGate = topicRegionHubPassesGate({
    indexableEventCount,
    distinctSponsorCount,
  });

  const locationName = locationRow.name;
  const facts: TopicRegionHubFacts = {
    topicName: topic.name,
    locationName,
    eventCount: eventCards.length,
    indexableEventCount,
    seriesCount: seriesIdSet.size,
    yearMin,
    yearMax,
    countryNames,
    distinctSponsorCount,
  };

  const hubPath = formatResearchPagePublicPath(topicSlug, location, year);
  const hubLastReviewedAt = maxLastReviewedAt(
    eventCards.map((event) => event.lastReviewedAt),
  );
  const title = buildTopicRegionHubTitle(topic.name, locationName, year);
  const eyebrow =
    year === null
      ? `${topic.name} · ${locationName}`
      : `${topic.name} · ${locationName} · ${year}`;

  return {
    path: hubPath,
    title,
    metaDescription: buildTopicRegionHubMetaDescription(facts),
    h1: title,
    eyebrow,
    topicName: topic.name,
    locationType: location.type,
    locationName,
    summary: buildTopicRegionHubSummary(facts),
    lastReviewedAt: hubLastReviewedAt,
    lastReviewedLabel: formatTopicRegionHubLastReviewed(hubLastReviewedAt),
    facts,
    events: eventCards,
    sponsors: sponsors.slice(0, TOPIC_REGION_HUB_SPONSOR_DISPLAY_LIMIT),
    totalSponsorCount: distinctSponsorCount,
    topicHubPath: `/topics/${topicSlug}`,
    passesGate,
  };
}
