/**
 * Measure Event Explorer payload sizes (current server shape).
 * Run: npx tsx --env-file=.env.local scripts/measure-event-explorer-payload.ts
 */
import { createClient } from "@supabase/supabase-js";
import { performance } from "node:perf_hooks";

import {
  normalizeEventExplorerFilters,
  readExplorerSeriesId,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  buildEventExplorerFilterFacetsFromEditions,
} from "@/src/features/events/lib/eventExplorerFilterFacets";
import { mergeTopicSeriesResolutions } from "@/src/features/events/server/getEventExplorerData";
import { getPublicKeywordsForSeriesIds } from "@/src/features/events/server/seriesKeywordsPublic";
import {
  getPublicKeywordBySlug,
  getSeriesIdsForKeywordId,
} from "@/src/features/events/server/topicHubPublic";
import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";
import {
  getSponsorCountsByEditionIds,
  readSponsorCountForEdition,
} from "@/src/lib/queries/companies";
import { mapEventEditionSeriesEmbedForDisplay } from "@/src/lib/storage/mapPublicLogoUrl";

type Scenario = {
  label: string;
  filters: Parameters<typeof normalizeEventExplorerFilters>[0];
};

const SCENARIOS: Scenario[] = [
  { label: "no filters", filters: {} },
  { label: "topic=bitcoin", filters: { topics: ["bitcoin"] } },
  { label: "topic=bitcoin&topic=ai", filters: { topics: ["bitcoin", "ai"] } },
  { label: "region=United States", filters: { regions: ["United States"] } },
  { label: "q=token", filters: { query: "token" } },
  { label: "topic=unknown-slug-xyz", filters: { topics: ["unknown-slug-xyz"] } },
];

type ClientEventRecord = {
  id: string;
  slug?: string | null;
  name?: string | null;
  website_url?: string | null;
  sponsor_count?: number;
  last_reviewed_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  event_series?: {
    name?: string | null;
    logo_url?: string | null;
    website_url?: string | null;
  } | null;
  series_keywords?: readonly { id: string; name: string; slug: string }[];
  cities?: {
    name?: string | null;
    states?: { name?: string | null } | null;
    countries?: { name?: string | null } | null;
  } | null;
};

function mapToClientRecord(edition: Record<string, unknown>): ClientEventRecord {
  return {
    id: String(edition.id),
    slug: (edition.slug as string | null) ?? null,
    name: (edition.name as string | null) ?? null,
    website_url: (edition.website_url as string | null) ?? null,
    sponsor_count:
      typeof edition.sponsor_count === "number" ? edition.sponsor_count : 0,
    last_reviewed_at:
      typeof edition.last_reviewed_at === "string" ? edition.last_reviewed_at : null,
    start_date: (edition.start_date as string | null) ?? null,
    end_date: (edition.end_date as string | null) ?? null,
    event_series: edition.event_series
      ? {
          name: (edition.event_series as { name?: string | null }).name ?? null,
          logo_url: (edition.event_series as { logo_url?: string | null }).logo_url ?? null,
          website_url:
            (edition.event_series as { website_url?: string | null }).website_url ?? null,
        }
      : null,
    series_keywords: Array.isArray(edition.series_keywords)
      ? (edition.series_keywords as { id: string; name: string; slug: string }[]).map(
          (keyword) => ({
            id: keyword.id,
            name: keyword.name,
            slug: keyword.slug,
          }),
        )
      : [],
    cities: edition.cities
      ? {
          name: (edition.cities as { name?: string | null }).name ?? null,
          states:
            edition.cities &&
            typeof edition.cities === "object" &&
            (edition.cities as { states?: unknown }).states &&
            typeof (edition.cities as { states: unknown }).states === "object"
              ? {
                  name:
                    ((edition.cities as { states: { name?: string | null } }).states
                      .name) ?? null,
                }
              : null,
          countries:
            edition.cities &&
            typeof edition.cities === "object" &&
            (edition.cities as { countries?: unknown }).countries
              ? {
                  name:
                    ((edition.cities as { countries: { name?: string | null } }).countries
                      .name) ?? null,
                }
              : null,
        }
      : null,
  };
}

function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function resolveTopicSeriesIds(topicSlugs: readonly string[]) {
  if (topicSlugs.length === 0) return null;

  const resolutions = await Promise.all(
    topicSlugs.map(async (slug) => {
      const keyword = await getPublicKeywordBySlug(slug);
      if (!keyword) {
        return { slug, keyword: null, seriesIds: [] as string[] };
      }
      return {
        slug,
        keyword: { slug: keyword.slug, name: keyword.name },
        seriesIds: await getSeriesIdsForKeywordId(keyword.id),
      };
    }),
  );
  return mergeTopicSeriesResolutions(resolutions).topicSeriesIds;
}

async function buildCatalogWithCounts() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .order("start_date", { ascending: true });

  if (error) throw new Error(error.message);

  const editions = (data ?? []).map(
    (edition) =>
      mapEventEditionSeriesEmbedForDisplay(
        edition as Record<string, unknown>,
      ) as Record<string, unknown>,
  );

  const seriesIds = editions
    .map((edition) => readExplorerSeriesId(edition))
    .filter((seriesId) => seriesId !== "");
  const keywordsBySeriesId = await getPublicKeywordsForSeriesIds(seriesIds);
  const editionsWithKeywords = editions.map((edition) => {
    const seriesId = readExplorerSeriesId(edition);
    return {
      ...edition,
      series_keywords:
        seriesId !== "" ? (keywordsBySeriesId.get(seriesId) ?? []) : [],
    };
  });

  const sponsorCountsByEditionId = await getSponsorCountsByEditionIds(
    editionsWithKeywords.map((edition) =>
      String((edition as Record<string, unknown>).id),
    ),
  );

  return editionsWithKeywords.map((edition) => ({
    ...edition,
    sponsor_count: readSponsorCountForEdition(
      sponsorCountsByEditionId,
      String((edition as Record<string, unknown>).id),
    ),
  }));
}

async function main() {
  console.log("Event Explorer payload measurement\n");

  const start = performance.now();
  const catalog = await buildCatalogWithCounts();
  const catalogMs = performance.now() - start;

  const catalogRecords = catalog.map((edition) => mapToClientRecord(edition));
  const catalogBytes = byteSize(catalogRecords);
  const sponsorOnlyBytes = byteSize(
    catalogRecords.map((event) => ({ id: event.id, sponsor_count: event.sponsor_count ?? 0 })),
  );

  const facets = buildEventExplorerFilterFacetsFromEditions(catalog, catalog);
  const facetsBytes = byteSize(facets);

  console.log("Full catalog (proposed client payload)");
  console.log(`  editions:            ${catalogRecords.length}`);
  console.log(`  build time:          ${catalogMs.toFixed(1)}ms`);
  console.log(`  catalog JSON:        ${formatKb(catalogBytes)} (${catalogBytes} bytes)`);
  console.log(`  sponsor counts only: ${formatKb(sponsorOnlyBytes)}`);
  console.log(`  filter facets:       ${formatKb(facetsBytes)}`);
  console.log("");

  const { applyEventExplorerFilters } = await import(
    "@/src/features/events/lib/eventExplorerQuery"
  );

  console.log("Filtered subsets (current server returns only these)");
  for (const scenario of SCENARIOS) {
    const filters = normalizeEventExplorerFilters(scenario.filters);
    const topicSeriesIds = await resolveTopicSeriesIds(filters.topics);
    const filtered = applyEventExplorerFilters(catalog, filters, { topicSeriesIds });
    const records = filtered.map((edition) => mapToClientRecord(edition));
    console.log(
      `  ${scenario.label.padEnd(28)} count=${String(records.length).padStart(4)}  ${formatKb(byteSize(records))}`,
    );
  }

  console.log("");
  const perEdition = catalogRecords.length > 0 ? catalogBytes / catalogRecords.length : 0;
  console.log("Assessment");
  console.log(`  avg bytes/edition:   ${perEdition.toFixed(0)}`);
  const acceptable =
    catalogBytes < 2_000_000 ? "yes (<2 MB)" : catalogBytes < 5_000_000 ? "borderline (2–5 MB)" : "no (>5 MB)";
  console.log(`  full catalog OK:   ${acceptable}`);

  const omitLogoBytes = byteSize(
    catalogRecords.map(({ event_series, ...rest }) => ({
      ...rest,
      event_series: event_series
        ? { name: event_series.name, website_url: event_series.website_url }
        : null,
    })),
  );
  console.log(`  without logo_url:  ${formatKb(omitLogoBytes)} (saves ${formatKb(catalogBytes - omitLogoBytes)})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
