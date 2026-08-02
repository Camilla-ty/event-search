import { createClient } from "@/src/lib/supabase/server";

export type PublishedResearchPage = {
  id: string;
  topicName: string;
  topicSlug: string;
  regionName: string;
  regionSlug: string;
  /** null = All years. */
  year: number | null;
  publishedAt: string | null;
};

type PublishedResearchPageRow = {
  id?: unknown;
  year?: unknown;
  published_at?: unknown;
  topic_name?: unknown;
  topic_slug?: unknown;
  region_name?: unknown;
  region_slug?: unknown;
};

function readYear(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

/** Map published research-page view rows (exported for tests). */
export function mapPublishedResearchPageRows(
  rows: readonly PublishedResearchPageRow[],
): PublishedResearchPage[] {
  const items: PublishedResearchPage[] = [];

  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const topicName = typeof row.topic_name === "string" ? row.topic_name.trim() : "";
    const topicSlug = typeof row.topic_slug === "string" ? row.topic_slug.trim() : "";
    const regionName = typeof row.region_name === "string" ? row.region_name.trim() : "";
    const regionSlug = typeof row.region_slug === "string" ? row.region_slug.trim() : "";
    if (!id || !topicName || !topicSlug || !regionName || !regionSlug) continue;

    items.push({
      id,
      topicName,
      topicSlug,
      regionName,
      regionSlug,
      year: readYear(row.year),
      publishedAt:
        typeof row.published_at === "string" ? row.published_at : null,
    });
  }

  return items;
}

/**
 * Published Topic × Region research pages for public sitemap / discovery.
 * Reads `topic_region_research_pages_published` via the session client
 * (ARC-001 Phase 6). Does not expose draft rows.
 */
export async function listPublishedResearchPagesPublic(): Promise<
  PublishedResearchPage[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topic_region_research_pages_published")
    .select(
      "id, year, published_at, topic_name, topic_slug, region_name, region_slug",
    )
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);
  return mapPublishedResearchPageRows((data ?? []) as PublishedResearchPageRow[]);
}

/**
 * Look up a published research page by topic+region (+ optional year).
 * year = null → all-years row only (year IS NULL).
 * year = number → exact year-scoped row only.
 */
export async function getPublishedResearchPageBySlugsPublic(
  topicSlug: string,
  regionSlug: string,
  year: number | null = null,
): Promise<{ id: string } | null> {
  const topicKey = topicSlug.trim();
  const regionKey = regionSlug.trim();
  if (topicKey === "" || regionKey === "") return null;

  const supabase = await createClient();
  let query = supabase
    .from("topic_region_research_pages_published")
    .select("id, year")
    .eq("topic_slug", topicKey)
    .eq("region_slug", regionKey);

  if (year === null) {
    query = query.is("year", null);
  } else {
    query = query.eq("year", year);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || typeof data.id !== "string" || data.id.trim() === "") return null;
  return { id: data.id };
}
