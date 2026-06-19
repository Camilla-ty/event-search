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
