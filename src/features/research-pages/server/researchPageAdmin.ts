import { createAdminClient } from "@/src/lib/supabase/admin";

export type ResearchPageStatus = "draft" | "published";

export type ResearchPageListItem = {
  id: string;
  topicName: string;
  topicSlug: string;
  regionName: string;
  regionSlug: string;
  status: ResearchPageStatus;
  publishedAt: string | null;
  createdAt: string;
};

type ResearchPageRow = {
  id: string;
  status: string;
  published_at: string | null;
  created_at: string;
  keyword: { name: string; slug: string } | { name: string; slug: string }[] | null;
  regions: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

function readEmbedded(raw: unknown): { name: string; slug: string } | null {
  if (raw === null || raw === undefined) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (row === null || typeof row !== "object") return null;
  const obj = row as Record<string, unknown>;
  if (typeof obj.name !== "string" || typeof obj.slug !== "string") return null;
  return { name: obj.name, slug: obj.slug };
}

function isValidStatus(value: unknown): value is ResearchPageStatus {
  return value === "draft" || value === "published";
}

function mapRow(raw: ResearchPageRow): ResearchPageListItem | null {
  const topic = readEmbedded(raw.keyword);
  const region = readEmbedded(raw.regions);
  if (!topic || !region) return null;
  if (!isValidStatus(raw.status)) return null;

  return {
    id: raw.id,
    topicName: topic.name,
    topicSlug: topic.slug,
    regionName: region.name,
    regionSlug: region.slug,
    status: raw.status,
    publishedAt: raw.published_at,
    createdAt: raw.created_at,
  };
}

export async function listResearchPagesAdmin(): Promise<ResearchPageListItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("topic_region_research_pages")
    .select(`
      id,
      status,
      published_at,
      created_at,
      keyword:topic_keyword_id ( name, slug ),
      regions:region_id ( name, slug )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const items: ResearchPageListItem[] = [];
  for (const row of data ?? []) {
    const mapped = mapRow(row as unknown as ResearchPageRow);
    if (mapped) items.push(mapped);
  }
  return items;
}

export type TopicOption = { id: string; name: string; slug: string };
export type RegionOption = { id: string; name: string; slug: string };

export async function listTopicOptionsAdmin(): Promise<TopicOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("keyword")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    slug: typeof row.slug === "string" ? row.slug : "",
  }));
}

export async function listRegionOptionsAdmin(): Promise<RegionOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("regions")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    slug: typeof row.slug === "string" ? row.slug : "",
  }));
}

export async function getResearchPageById(
  id: string,
): Promise<ResearchPageListItem | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("topic_region_research_pages")
    .select(`
      id,
      status,
      published_at,
      created_at,
      keyword:topic_keyword_id ( name, slug ),
      regions:region_id ( name, slug )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as unknown as ResearchPageRow);
}

export async function publishResearchPage(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("topic_region_research_pages")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function unpublishResearchPage(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("topic_region_research_pages")
    .update({ status: "draft", published_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Look up a published research page by topic+region slugs.
 * Used by the generic public route to gate access.
 */
export async function getPublishedResearchPageBySlugs(
  topicSlug: string,
  regionSlug: string,
): Promise<{ id: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("topic_region_research_pages")
    .select(`
      id,
      keyword:topic_keyword_id ( name, slug ),
      regions:region_id ( name, slug )
    `)
    .eq("status", "published")
    .limit(100);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const kw = readEmbedded(row.keyword as unknown);
    const rg = readEmbedded(row.regions as unknown);
    if (kw?.slug === topicSlug && rg?.slug === regionSlug) {
      return { id: row.id };
    }
  }
  return null;
}

export async function createResearchPageDraft(input: {
  topicKeywordId: string;
  regionId: string;
}): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("topic_region_research_pages")
    .insert({
      topic_keyword_id: input.topicKeywordId,
      region_id: input.regionId,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("This Topic × Region combination already exists.");
    }
    throw new Error(error.message);
  }

  return { id: data.id as string };
}
