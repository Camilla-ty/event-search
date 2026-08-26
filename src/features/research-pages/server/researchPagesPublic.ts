import {
  parseResearchPageLocationType,
  type ResearchPageLocation,
  type ResearchPageLocationType,
} from "@/src/features/research-pages/lib/researchPageLocation";
import { createClient } from "@/src/lib/supabase/server";

const PUBLISHED_SELECT =
  "id, year, published_at, topic_name, topic_slug, location_type, location_name, location_slug";

export type PublishedResearchPage = {
  id: string;
  topicName: string;
  topicSlug: string;
  locationType: ResearchPageLocationType;
  locationName: string;
  locationSlug: string;
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
  location_type?: unknown;
  location_name?: unknown;
  location_slug?: unknown;
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
    const locationName =
      typeof row.location_name === "string" ? row.location_name.trim() : "";
    const locationSlug =
      typeof row.location_slug === "string" ? row.location_slug.trim() : "";
    const locationType = parseResearchPageLocationType(row.location_type);
    if (!id || !topicName || !topicSlug || !locationName || !locationSlug) continue;
    if (locationType === null) continue;

    items.push({
      id,
      topicName,
      topicSlug,
      locationType,
      locationName,
      locationSlug,
      year: readYear(row.year),
      publishedAt:
        typeof row.published_at === "string" ? row.published_at : null,
    });
  }

  return items;
}

/**
 * Published Topic × Location research pages for public sitemap / discovery.
 * Reads `topic_region_research_pages_published` via the session client
 * (ARC-001 Phase 6). Does not expose draft rows.
 */
export async function listPublishedResearchPagesPublic(): Promise<
  PublishedResearchPage[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topic_region_research_pages_published")
    .select(PUBLISHED_SELECT)
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);
  return mapPublishedResearchPageRows((data ?? []) as PublishedResearchPageRow[]);
}

/**
 * Published research pages for one topic, for on-page location discovery.
 * Ordered by location name, then all-years before year-scoped entries.
 */
export async function listPublishedResearchPagesByTopicPublic(
  topicSlug: string,
): Promise<PublishedResearchPage[]> {
  const topicKey = topicSlug.trim();
  if (topicKey === "") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topic_region_research_pages_published")
    .select(PUBLISHED_SELECT)
    .eq("topic_slug", topicKey)
    .order("location_name", { ascending: true })
    .order("year", { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);
  return mapPublishedResearchPageRows((data ?? []) as PublishedResearchPageRow[]);
}

/**
 * Look up a published research page by topic + location (+ optional year).
 * year = null → all-years row only (year IS NULL).
 * year = number → exact year-scoped row only.
 */
export async function getPublishedResearchPageBySlugsPublic(
  topicSlug: string,
  location: ResearchPageLocation,
  year: number | null = null,
): Promise<{ id: string } | null> {
  const topicKey = topicSlug.trim();
  const locationKey = location.slug.trim();
  if (topicKey === "" || locationKey === "") return null;

  const supabase = await createClient();
  let query = supabase
    .from("topic_region_research_pages_published")
    .select("id, year")
    .eq("topic_slug", topicKey)
    .eq("location_type", location.type)
    .eq("location_slug", locationKey);

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
