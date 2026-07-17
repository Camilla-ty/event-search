import type { MetadataRoute } from "next";

import {
  buildStaticSitemapEntries,
  fetchPublicCompanySitemapEntries,
  fetchPublicEventEditionSitemapEntries,
  fetchPublicEventSeriesSitemapEntries,
  fetchPublicTopicSitemapEntries,
} from "@/src/lib/seo/sitemapEntries";

/** Refresh catalog URLs periodically without regenerating on every request. */
export const revalidate = 3600;

/**
 * IR1: sitemap membership ⇔ indexable under indexability-policy.
 * Research routes intentionally omitted (no public routes yet — IR4).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [editions, series, sponsors, topics] = await Promise.all([
    fetchPublicEventEditionSitemapEntries(),
    fetchPublicEventSeriesSitemapEntries(),
    fetchPublicCompanySitemapEntries(),
    fetchPublicTopicSitemapEntries(),
  ]);

  return [
    ...buildStaticSitemapEntries(),
    ...editions,
    ...series,
    ...sponsors,
    ...topics,
  ];
}
