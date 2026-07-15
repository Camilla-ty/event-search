import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";

import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";

/** Canonical production origin for sitemap absolute URLs. */
const SITEMAP_BASE_URL = "https://app.eventpx.com";

/** Refresh catalog URLs periodically without regenerating on every request. */
export const revalidate = 3600;

type SlugRow = {
  slug: string | null;
  created_at?: string | null;
  last_reviewed_at?: string | null;
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

async function fetchPublicEventEditionEntries(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAnonSupabaseClient();
  const rows = await fetchAllPaginatedSupabaseRows<SlugRow>(async ({ from, to }) =>
    supabase
      .from("event_editions")
      .select("slug, created_at, last_reviewed_at")
      .not("slug", "is", null)
      .neq("slug", "")
      .order("slug", { ascending: true })
      .range(from, to),
  );

  const entries: MetadataRoute.Sitemap = [];
  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (slug === "") continue;
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

async function fetchPublicEventSeriesEntries(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAnonSupabaseClient();
  const rows = await fetchAllPaginatedSupabaseRows<SlugRow>(async ({ from, to }) =>
    supabase
      .from("event_series")
      .select("slug, created_at")
      .not("slug", "is", null)
      .neq("slug", "")
      .order("slug", { ascending: true })
      .range(from, to),
  );

  const entries: MetadataRoute.Sitemap = [];
  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (slug === "") continue;
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

async function fetchPublicSponsorEntries(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAnonSupabaseClient();
  const rows = await fetchAllPaginatedSupabaseRows<SlugRow>(async ({ from, to }) =>
    supabase
      .from("companies")
      .select("slug, created_at")
      .eq("status", "active")
      .is("restricted_at", null)
      .not("slug", "is", null)
      .neq("slug", "")
      .order("slug", { ascending: true })
      .range(from, to),
  );

  const entries: MetadataRoute.Sitemap = [];
  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (slug === "") continue;
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/") },
    { url: absoluteUrl("/events") },
    { url: absoluteUrl("/sponsors") },
  ];

  const [editions, series, sponsors] = await Promise.all([
    fetchPublicEventEditionEntries(),
    fetchPublicEventSeriesEntries(),
    fetchPublicSponsorEntries(),
  ]);

  return [...staticEntries, ...editions, ...series, ...sponsors];
}
