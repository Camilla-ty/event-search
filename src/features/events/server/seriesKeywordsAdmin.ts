import { mapKeywordRow } from "@/src/features/events/server/mapKeywordRow";
import type { KeywordRow } from "@/src/features/events/types/keywords";
import { createAdminClient } from "@/src/lib/supabase/admin";

export type { KeywordRow };

function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function normalizeKeywordIds(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    const trimmed = id.trim().toLowerCase();
    if (!isUuidString(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export async function listKeywordsAdmin(): Promise<KeywordRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("keyword")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const rows: KeywordRow[] = [];
  for (const raw of data ?? []) {
    const mapped = mapKeywordRow(raw);
    if (mapped) rows.push(mapped);
  }
  return rows;
}

export async function getKeywordsForSeriesId(seriesId: string): Promise<KeywordRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_series_keyword")
    .select("keyword_id, keyword ( id, name, slug )")
    .eq("series_id", seriesId);

  if (error) throw new Error(error.message);

  const rows: KeywordRow[] = [];
  for (const link of data ?? []) {
    const embedded = (link as { keyword?: unknown }).keyword;
    const keyword = Array.isArray(embedded) ? embedded[0] : embedded;
    const mapped = mapKeywordRow(keyword);
    if (mapped) rows.push(mapped);
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export async function getInheritedKeywordsForEditionId(
  editionId: string,
): Promise<KeywordRow[]> {
  const supabase = createAdminClient();
  const { data: edition, error: editionError } = await supabase
    .from("event_editions")
    .select("series_id")
    .eq("id", editionId)
    .maybeSingle();

  if (editionError) throw new Error(editionError.message);

  const seriesId =
    edition &&
    typeof edition.series_id === "string" &&
    edition.series_id.trim() !== ""
      ? edition.series_id.trim()
      : null;

  if (!seriesId) return [];
  return getKeywordsForSeriesId(seriesId);
}

export async function setSeriesKeywords(
  seriesId: string,
  keywordIds: readonly string[],
): Promise<void> {
  const supabase = createAdminClient();
  const uniqueIds = normalizeKeywordIds(keywordIds);

  if (uniqueIds.length > 0) {
    const { data: existing, error: lookupError } = await supabase
      .from("keyword")
      .select("id")
      .in("id", uniqueIds);

    if (lookupError) throw new Error(lookupError.message);

    const found = new Set<string>();
    for (const row of existing ?? []) {
      if (row && typeof row.id === "string") {
        found.add(row.id.trim().toLowerCase());
      }
    }

    const missing = uniqueIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new Error(`Unknown keyword id(s): ${missing.join(", ")}`);
    }
  }

  const { error: deleteError } = await supabase
    .from("event_series_keyword")
    .delete()
    .eq("series_id", seriesId);

  if (deleteError) throw new Error(deleteError.message);

  if (uniqueIds.length === 0) return;

  const inserts = uniqueIds.map((keyword_id) => ({
    series_id: seriesId,
    keyword_id,
  }));

  const { error: insertError } = await supabase
    .from("event_series_keyword")
    .insert(inserts);

  if (insertError) throw new Error(insertError.message);
}
