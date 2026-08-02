import type { MetadataRoute } from "next";

import { PRODUCTION_SITE_ORIGIN } from "@/src/lib/metadata/site";
import {
  getCompanyIndexability,
  getEventEditionIndexability,
  getSeriesIndexability,
  getTopicIndexability,
  normalizeSeriesLifecycle,
} from "@/src/lib/seo/indexability";
import { getTopicRegionHubPageData } from "@/src/features/events/server/topicRegionHubData";
import { listPublishedResearchPagesPublic } from "@/src/features/research-pages/server/researchPagesPublic";
import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";
import { createClient } from "@supabase/supabase-js";

const SITEMAP_BASE_URL = PRODUCTION_SITE_ORIGIN;

type CompanySitemapRow = {
  id: string;
  slug: string | null;
  created_at?: string | null;
  status?: string | null;
  restricted_at?: string | null;
  event_brand_public_profile_approved_at?: string | null;
};

type SameBrandSeriesSitemapRow = {
  company_profile_id: string | null;
  slug: string | null;
  lifecycle_status?: string | null;
};

type EditionSitemapRow = {
  id: string;
  slug: string | null;
  created_at?: string | null;
  last_reviewed_at?: string | null;
};

type SeriesSitemapRow = {
  slug: string | null;
  created_at?: string | null;
  lifecycle_status?: string | null;
};

type TopicSitemapRow = {
  slug: string | null;
};

type SponsorStatsRow = {
  company_id: string;
  sponsored_edition_count: number | null;
};

type SponsorLinkRow = {
  event_editions_id: string | null;
};

function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${SITEMAP_BASE_URL}/`).toString();
}

function parseLastModified(
  value: string | null | undefined,
): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function entryForSlug(params: {
  pathPrefix: string;
  slug: string;
  lastModified?: Date;
}): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(`${params.pathPrefix}/${encodeURIComponent(params.slug)}`),
    ...(params.lastModified ? { lastModified: params.lastModified } : {}),
  };
}

function createAnonSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeUuidKey(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Company IDs with sponsored_edition_count >= 1 (authoritative public count). */
export async function fetchIndexableSponsoredCompanyIdSet(): Promise<
  Set<string>
> {
  const supabase = createAnonSupabaseClient();
  const rows = await fetchAllPaginatedSupabaseRows<SponsorStatsRow>(
    async ({ from, to }) =>
      supabase
        .from("company_sponsor_stats")
        .select("company_id, sponsored_edition_count")
        .gt("sponsored_edition_count", 0)
        .order("company_id", { ascending: true })
        .range(from, to),
  );

  const ids = new Set<string>();
  for (const row of rows) {
    if (typeof row.company_id !== "string") continue;
    const count =
      typeof row.sponsored_edition_count === "number"
        ? row.sponsored_edition_count
        : 0;
    if (
      !getCompanyIndexability({
        restricted: false,
        sponsoredEditionCount: count,
      }).includeInSitemap
    ) {
      continue;
    }
    const key = normalizeUuidKey(row.company_id);
    if (key !== "") ids.add(key);
  }
  return ids;
}

/** Edition IDs with at least one event_sponsors row. */
export async function fetchEditionIdsWithSponsorsSet(): Promise<Set<string>> {
  const supabase = createAnonSupabaseClient();
  const rows = await fetchAllPaginatedSupabaseRows<SponsorLinkRow>(
    async ({ from, to }) =>
      supabase
        .from("event_sponsors")
        .select("event_editions_id")
        .order("event_editions_id", { ascending: true })
        .range(from, to),
  );

  const ids = new Set<string>();
  for (const row of rows) {
    if (typeof row.event_editions_id !== "string") continue;
    const key = normalizeUuidKey(row.event_editions_id);
    if (key !== "") ids.add(key);
  }
  return ids;
}

/** Reverse same-brand Series keyed by company id (for ADR-005 EB2 soft retirement). */
export async function fetchSameBrandSeriesByCompanyIdMap(): Promise<
  Map<string, { slug: string | null; lifecycle_status: string | null }>
> {
  const supabase = createAnonSupabaseClient();
  const rows = await fetchAllPaginatedSupabaseRows<SameBrandSeriesSitemapRow>(
    async ({ from, to }) =>
      supabase
        .from("event_series")
        .select("company_profile_id, slug, lifecycle_status")
        .not("company_profile_id", "is", null)
        .order("company_profile_id", { ascending: true })
        .range(from, to),
  );

  const map = new Map<
    string,
    { slug: string | null; lifecycle_status: string | null }
  >();
  for (const row of rows) {
    if (typeof row.company_profile_id !== "string") continue;
    const key = normalizeUuidKey(row.company_profile_id);
    if (key === "") continue;
    map.set(key, {
      slug: typeof row.slug === "string" ? row.slug : null,
      lifecycle_status:
        typeof row.lifecycle_status === "string" ? row.lifecycle_status : null,
    });
  }
  return map;
}

export async function fetchPublicCompanySitemapEntries(): Promise<
  MetadataRoute.Sitemap
> {
  const supabase = createAnonSupabaseClient();
  const [indexableIds, sameBrandSeriesByCompanyId, rows] = await Promise.all([
    fetchIndexableSponsoredCompanyIdSet(),
    fetchSameBrandSeriesByCompanyIdMap(),
    fetchAllPaginatedSupabaseRows<CompanySitemapRow>(async ({ from, to }) =>
      supabase
        .from("companies")
        .select(
          "id, slug, created_at, status, restricted_at, event_brand_public_profile_approved_at",
        )
        .eq("status", "active")
        .is("restricted_at", null)
        .not("slug", "is", null)
        .neq("slug", "")
        .order("slug", { ascending: true })
        .range(from, to),
    ),
  ]);

  const entries: MetadataRoute.Sitemap = [];
  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (slug === "") continue;
    const companyId =
      typeof row.id === "string" ? normalizeUuidKey(row.id) : "";
    const restricted = row.restricted_at != null;
    const sponsoredEditionCount = indexableIds.has(companyId) ? 1 : 0;
    const sameBrandSeries = sameBrandSeriesByCompanyId.get(companyId) ?? null;
    const decision = getCompanyIndexability({
      restricted,
      sponsoredEditionCount,
      id: row.id,
      slug,
      status: typeof row.status === "string" ? row.status : "active",
      eventBrandPublicProfileApprovedAt:
        typeof row.event_brand_public_profile_approved_at === "string"
          ? row.event_brand_public_profile_approved_at
          : null,
      sameBrandSeries,
    });
    if (!decision.includeInSitemap) continue;
    entries.push(
      entryForSlug({
        pathPrefix: "/sponsors",
        slug,
        lastModified: parseLastModified(row.created_at),
      }),
    );
  }
  return entries;
}

export async function fetchPublicEventEditionSitemapEntries(): Promise<
  MetadataRoute.Sitemap
> {
  const supabase = createAnonSupabaseClient();
  const [editionIdsWithSponsors, rows] = await Promise.all([
    fetchEditionIdsWithSponsorsSet(),
    fetchAllPaginatedSupabaseRows<EditionSitemapRow>(async ({ from, to }) =>
      supabase
        .from("event_editions")
        .select("id, slug, created_at, last_reviewed_at")
        .not("slug", "is", null)
        .neq("slug", "")
        .order("slug", { ascending: true })
        .range(from, to),
    ),
  ]);

  const entries: MetadataRoute.Sitemap = [];
  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (slug === "") continue;
    const editionId =
      typeof row.id === "string" ? normalizeUuidKey(row.id) : "";
    const sponsorCount = editionIdsWithSponsors.has(editionId) ? 1 : 0;
    if (!getEventEditionIndexability({ sponsorCount }).includeInSitemap) {
      continue;
    }
    entries.push(
      entryForSlug({
        pathPrefix: "/events",
        slug,
        lastModified:
          parseLastModified(row.last_reviewed_at) ??
          parseLastModified(row.created_at),
      }),
    );
  }
  return entries;
}

export async function fetchPublicEventSeriesSitemapEntries(): Promise<
  MetadataRoute.Sitemap
> {
  const supabase = createAnonSupabaseClient();
  const rows = await fetchAllPaginatedSupabaseRows<SeriesSitemapRow>(
    async ({ from, to }) =>
      supabase
        .from("event_series")
        .select("slug, created_at, lifecycle_status")
        .not("slug", "is", null)
        .neq("slug", "")
        .order("slug", { ascending: true })
        .range(from, to),
  );

  const entries: MetadataRoute.Sitemap = [];
  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (slug === "") continue;
    const lifecycle = normalizeSeriesLifecycle(row.lifecycle_status);
    const decision = getSeriesIndexability({
      lifecycleStatus: row.lifecycle_status,
      treatAsMergedNonDestination: lifecycle === "merged",
    });
    if (!decision.includeInSitemap) continue;
    entries.push(
      entryForSlug({
        pathPrefix: "/events/series",
        slug,
        lastModified: parseLastModified(row.created_at),
      }),
    );
  }
  return entries;
}

export async function fetchPublicTopicSitemapEntries(): Promise<
  MetadataRoute.Sitemap
> {
  const supabase = createAnonSupabaseClient();
  const rows = await fetchAllPaginatedSupabaseRows<TopicSitemapRow>(
    async ({ from, to }) =>
      supabase
        .from("keyword")
        .select("slug")
        .not("slug", "is", null)
        .neq("slug", "")
        .order("slug", { ascending: true })
        .range(from, to),
  );

  const entries: MetadataRoute.Sitemap = [];
  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (slug === "") continue;
    if (!getTopicIndexability().includeInSitemap) continue;
    entries.push(entryForSlug({ pathPrefix: "/topics", slug }));
  }
  return entries;
}

export function buildStaticSitemapEntries(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/") },
    { url: absoluteUrl("/events") },
    { url: absoluteUrl("/sponsors") },
  ];
}

/**
 * Include all published Topic × Region research pages whose quality gate passes.
 */
export async function fetchResearchPageSitemapEntries(): Promise<
  MetadataRoute.Sitemap
> {
  const published = await listPublishedResearchPagesPublic();

  const entries: MetadataRoute.Sitemap = [];
  for (const page of published) {
    const data = await getTopicRegionHubPageData(
      page.topicSlug,
      page.regionSlug,
      page.year,
    );
    if (!data || !data.passesGate) continue;
    entries.push({ url: absoluteUrl(data.path) });
  }
  return entries;
}
