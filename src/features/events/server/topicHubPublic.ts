import {
  mapPublicEditionRow,
  mapPublicEventSeries,
} from "@/src/features/events/server/mapPublicEditionRow";
import { mapKeywordRow } from "@/src/features/events/server/mapKeywordRow";
import type {
  PublicEditionSummary,
  PublicEventSeriesSummary,
} from "@/src/features/events/types/publicEdition";
import type { PublicKeywordSummary } from "@/src/features/events/types/keywords";
import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";
import { createClient } from "@/src/lib/supabase/server";

export type { PublicKeywordSummary };

const EVENT_SERIES_PUBLIC_SELECT =
  "id, name, slug, description, website_url, logo_url";

export type TopicHubData = {
  topic: PublicKeywordSummary;
  series: PublicEventSeriesSummary[];
  editions: PublicEditionSummary[];
};

export function readSeriesIdsFromKeywordLinks(links: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const link of links) {
    if (link === null || typeof link !== "object") continue;
    const seriesId = (link as { series_id?: unknown }).series_id;
    if (typeof seriesId !== "string") continue;
    const trimmed = seriesId.trim();
    if (trimmed === "" || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ids.push(trimmed);
  }
  return ids;
}

export function sortPublicEventSeriesByName(
  series: readonly PublicEventSeriesSummary[],
): PublicEventSeriesSummary[] {
  return series
    .slice()
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

export function sortPublicEditionsForTopicHub(
  editions: readonly PublicEditionSummary[],
): PublicEditionSummary[] {
  return editions.slice().sort((a, b) => {
    const yearA = a.year ?? -1;
    const yearB = b.year ?? -1;
    if (yearA !== yearB) return yearB - yearA;

    const startA = a.start_date ?? "";
    const startB = b.start_date ?? "";
    if (startA !== startB) return startB.localeCompare(startA);

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function getPublicKeywordBySlug(
  slug: string,
): Promise<PublicKeywordSummary | null> {
  const trimmedSlug = slug.trim();
  if (trimmedSlug === "") return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("keyword")
    .select("id, name, slug")
    .eq("slug", trimmedSlug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapKeywordRow(data);
}

export async function getSeriesIdsForKeywordId(keywordId: string): Promise<string[]> {
  const trimmedKeywordId = keywordId.trim();
  if (trimmedKeywordId === "") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_series_keyword")
    .select("series_id")
    .eq("keyword_id", trimmedKeywordId);

  if (error) throw new Error(error.message);
  return readSeriesIdsFromKeywordLinks(data ?? []);
}

export async function getTopicHubData(slug: string): Promise<TopicHubData | null> {
  const topic = await getPublicKeywordBySlug(slug);
  if (!topic) return null;

  const seriesIds = await getSeriesIdsForKeywordId(topic.id);
  if (seriesIds.length === 0) {
    return { topic, series: [], editions: [] };
  }

  const supabase = await createClient();
  const [seriesResult, editionsResult] = await Promise.all([
    supabase.from("event_series").select(EVENT_SERIES_PUBLIC_SELECT).in("id", seriesIds),
    supabase
      .from("event_editions")
      .select(EVENT_EDITION_LIST_SELECT)
      .in("series_id", seriesIds)
      .order("year", { ascending: false })
      .order("start_date", { ascending: false }),
  ]);

  if (seriesResult.error) throw new Error(seriesResult.error.message);
  if (editionsResult.error) throw new Error(editionsResult.error.message);

  const series: PublicEventSeriesSummary[] = [];
  for (const row of seriesResult.data ?? []) {
    const mapped = mapPublicEventSeries(row);
    if (mapped) series.push(mapped);
  }

  const editions: PublicEditionSummary[] = [];
  for (const row of editionsResult.data ?? []) {
    const mapped = mapPublicEditionRow(row);
    if (mapped) editions.push(mapped);
  }

  return {
    topic,
    series: sortPublicEventSeriesByName(series),
    editions: sortPublicEditionsForTopicHub(editions),
  };
}
