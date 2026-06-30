import { mapKeywordRow } from "@/src/features/events/server/mapKeywordRow";
import type { PublicKeywordSummary } from "@/src/features/events/types/keywords";
import { createClient } from "@/src/lib/supabase/server";

export type { PublicKeywordSummary };

function readKeywordFromSeriesKeywordLink(link: unknown): unknown {
  if (link === null || typeof link !== "object") return null;
  const embedded = (link as { keyword?: unknown }).keyword;
  return Array.isArray(embedded) ? embedded[0] : embedded;
}

export function sortPublicKeywordsByName(
  keywords: readonly PublicKeywordSummary[],
): PublicKeywordSummary[] {
  return keywords
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function mapPublicKeywordsFromSeriesKeywordLinks(
  links: readonly unknown[],
): PublicKeywordSummary[] {
  const rows: PublicKeywordSummary[] = [];
  for (const link of links) {
    const mapped = mapKeywordRow(readKeywordFromSeriesKeywordLink(link));
    if (mapped) rows.push(mapped);
  }
  return sortPublicKeywordsByName(rows);
}

function readSeriesIdFromKeywordLink(link: unknown): string {
  if (link === null || typeof link !== "object") return "";
  const seriesId = (link as { series_id?: unknown }).series_id;
  return typeof seriesId === "string" ? seriesId.trim() : "";
}

export function groupPublicKeywordsBySeriesId(
  links: readonly unknown[],
): Map<string, PublicKeywordSummary[]> {
  const grouped = new Map<string, PublicKeywordSummary[]>();

  for (const link of links) {
    const seriesId = readSeriesIdFromKeywordLink(link);
    if (seriesId === "") continue;

    const mapped = mapKeywordRow(readKeywordFromSeriesKeywordLink(link));
    if (!mapped) continue;

    const bucket = grouped.get(seriesId) ?? [];
    bucket.push(mapped);
    grouped.set(seriesId, bucket);
  }

  for (const [seriesId, keywords] of grouped) {
    grouped.set(seriesId, sortPublicKeywordsByName(keywords));
  }

  return grouped;
}

export async function getPublicKeywordsForSeriesIds(
  seriesIds: readonly string[],
): Promise<Map<string, PublicKeywordSummary[]>> {
  const uniqueIds = Array.from(
    new Set(seriesIds.map((seriesId) => seriesId.trim()).filter((seriesId) => seriesId !== "")),
  );
  if (uniqueIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_series_keyword")
    .select("series_id, keyword_id, keyword ( id, name, slug )")
    .in("series_id", uniqueIds);

  if (error) throw new Error(error.message);

  return groupPublicKeywordsBySeriesId(data ?? []);
}

export async function getPublicKeywordsForSeriesId(
  seriesId: string,
): Promise<PublicKeywordSummary[]> {
  const trimmedSeriesId = seriesId.trim();
  if (trimmedSeriesId === "") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_series_keyword")
    .select("keyword_id, keyword ( id, name, slug )")
    .eq("series_id", trimmedSeriesId);

  if (error) throw new Error(error.message);

  return mapPublicKeywordsFromSeriesKeywordLinks(data ?? []);
}
