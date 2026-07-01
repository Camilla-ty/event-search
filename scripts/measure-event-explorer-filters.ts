/**
 * Temporary local benchmark for Event Explorer filter flows.
 * Run: npx tsx --env-file=.env.local scripts/measure-event-explorer-filters.ts
 */
import { performance } from "node:perf_hooks";

import {
  applyEventExplorerFilters,
  normalizeEventExplorerFilters,
  readExplorerSeriesId,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  buildEventExplorerFilterFacetsFromEditions,
  getEventExplorerFacetEditions,
} from "@/src/features/events/lib/eventExplorerFilterFacets";
import { mergeTopicSeriesResolutions } from "@/src/features/events/server/getEventExplorerData";
import { getPublicKeywordsForSeriesIds } from "@/src/features/events/server/seriesKeywordsPublic";
import {
  getPublicKeywordBySlug,
  getSeriesIdsForKeywordId,
} from "@/src/features/events/server/topicHubPublic";
import { getEventEditions } from "@/src/lib/queries/events";
import {
  getSponsorCountsByEditionIds,
  readSponsorCountForEdition,
} from "@/src/lib/queries/companies";

type Flow = {
  id: string;
  label: string;
  topics: string[];
};

const FLOWS: Flow[] = [
  { id: "A", label: "topic=bitcoin", topics: ["bitcoin"] },
  { id: "B", label: "topic=bitcoin&topic=ai", topics: ["bitcoin", "ai"] },
  { id: "C", label: "remove ai from bitcoin&ai", topics: ["bitcoin"] },
  { id: "D", label: "clear all topics", topics: [] },
  { id: "E", label: "clear then bitcoin (step 2)", topics: ["bitcoin"] },
];

type PhaseTimings = {
  getEventEditions: number;
  keywordFetch: number;
  attachKeywords: number;
  topicResolution: number;
  filterFacets: number;
  applyFilters: number;
  sponsorCounts: number;
  attachSponsorCounts: number;
  total: number;
  editionCount: number;
  filteredCount: number;
  sponsorQueryCount: number;
};

async function resolveTopicFiltersTimed(topicSlugs: readonly string[]) {
  if (topicSlugs.length === 0) {
    return {
      topicSeriesIds: null as Set<string> | null,
      ms: 0,
    };
  }

  const start = performance.now();
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
  const { topicSeriesIds } = mergeTopicSeriesResolutions(resolutions);
  return { topicSeriesIds, ms: performance.now() - start };
}

async function measureFlow(flow: Flow): Promise<PhaseTimings> {
  const totalStart = performance.now();
  const filters = normalizeEventExplorerFilters({ topics: flow.topics });

  const editionsStart = performance.now();
  const editions = (await getEventEditions()) ?? [];
  const getEventEditionsMs = performance.now() - editionsStart;

  const seriesIds = editions
    .map((edition) => readExplorerSeriesId(edition))
    .filter((seriesId) => seriesId !== "");

  const keywordStart = performance.now();
  const keywordsBySeriesId = await getPublicKeywordsForSeriesIds(seriesIds);
  const keywordFetchMs = performance.now() - keywordStart;

  const attachStart = performance.now();
  const editionsWithKeywords = editions.map((edition) => {
    const seriesId = readExplorerSeriesId(edition);
    return {
      ...edition,
      series_keywords:
        seriesId !== "" ? (keywordsBySeriesId.get(seriesId) ?? []) : [],
    };
  });
  const attachKeywordsMs = performance.now() - attachStart;

  const { topicSeriesIds, ms: topicResolutionMs } = await resolveTopicFiltersTimed(
    filters.topics,
  );

  const facetStart = performance.now();
  const facetEditions = getEventExplorerFacetEditions(editionsWithKeywords, topicSeriesIds);
  const filterFacets = buildEventExplorerFilterFacetsFromEditions(
    facetEditions,
    editionsWithKeywords,
  );
  const filterFacetsMs = performance.now() - facetStart;

  const filterStart = performance.now();
  const filtered = applyEventExplorerFilters(editionsWithKeywords, filters, {
    topicSeriesIds,
  });
  const applyFiltersMs = performance.now() - filterStart;

  const filteredIds = filtered.map((edition) => String(edition.id));

  const sponsorStart = performance.now();
  const sponsorCountsByEditionId = await getSponsorCountsByEditionIds(filteredIds);
  const sponsorCountsMs = performance.now() - sponsorStart;

  const attachSponsorStart = performance.now();
  filtered.map((edition) => ({
    ...edition,
    sponsor_count: readSponsorCountForEdition(sponsorCountsByEditionId, String(edition.id)),
  }));
  const attachSponsorCountsMs = performance.now() - attachSponsorStart;

  return {
    getEventEditions: getEventEditionsMs,
    keywordFetch: keywordFetchMs,
    attachKeywords: attachKeywordsMs,
    topicResolution: topicResolutionMs,
    filterFacets: filterFacetsMs,
    applyFilters: applyFiltersMs,
    sponsorCounts: sponsorCountsMs,
    attachSponsorCounts: attachSponsorCountsMs,
    total: performance.now() - totalStart,
    editionCount: editions.length,
    filteredCount: filtered.length,
    sponsorQueryCount: filteredIds.length,
  };
}

function formatMs(value: number): string {
  return `${value.toFixed(1)}ms`;
}

async function main() {
  console.log("Event Explorer server filter benchmark\n");

  const results: Array<{ flow: Flow; timings: PhaseTimings }> = [];

  for (const flow of FLOWS) {
    const timings = await measureFlow(flow);
    results.push({ flow, timings });
    console.log(`Flow ${flow.id}: ${flow.label}`);
    console.log(`  total:              ${formatMs(timings.total)}`);
    console.log(`  getEventEditions:   ${formatMs(timings.getEventEditions)}`);
    console.log(`  keywordFetch:       ${formatMs(timings.keywordFetch)}`);
    console.log(`  topicResolution:    ${formatMs(timings.topicResolution)}`);
    console.log(`  filterFacets:       ${formatMs(timings.filterFacets)}`);
    console.log(`  applyFilters:       ${formatMs(timings.applyFilters)}`);
    console.log(`  sponsorCounts:      ${formatMs(timings.sponsorCounts)} (${timings.sponsorQueryCount} editions)`);
    console.log(`  filtered/total:     ${timings.filteredCount}/${timings.editionCount}`);
    console.log("");
  }

  const c = results.find((r) => r.flow.id === "C")!.timings;
  const e = results.find((r) => r.flow.id === "E")!.timings;
  const d = results.find((r) => r.flow.id === "D")!.timings;

  console.log("Comparisons:");
  console.log(
    `  C (remove ai) vs E (bitcoin after clear): total ${formatMs(c.total)} vs ${formatMs(e.total)} (delta ${formatMs(c.total - e.total)})`,
  );
  console.log(
    `  C sponsorCounts vs E sponsorCounts: ${formatMs(c.sponsorCounts)} vs ${formatMs(e.sponsorCounts)}`,
  );
  console.log(
    `  D (clear all) sponsor query size: ${d.sponsorQueryCount} editions vs C: ${c.sponsorQueryCount}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
