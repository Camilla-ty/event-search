import type { MetadataRoute } from "next";

import {
  buildStaticSitemapEntries,
  fetchPublicCompanySitemapEntries,
  fetchPublicEventEditionSitemapEntries,
  fetchPublicEventSeriesSitemapEntries,
  fetchPublicTopicSitemapEntries,
  fetchResearchPageSitemapEntries,
} from "@/src/lib/seo/sitemapEntries";

/** Refresh catalog URLs periodically without regenerating on every request. */
export const revalidate = 3600;

/**
 * IR1: sitemap membership ⇔ indexable under indexability-policy.
 * Research pages: published + quality gate passes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [editions, series, sponsors, topics, researchPages] = await Promise.all([
    fetchPublicEventEditionSitemapEntries(),
    fetchPublicEventSeriesSitemapEntries(),
    fetchPublicCompanySitemapEntries(),
    fetchPublicTopicSitemapEntries(),
    fetchResearchPageSitemapEntries(),
  ]);

  return [
    ...buildStaticSitemapEntries(),
    ...researchPages,
    ...editions,
    ...series,
    ...sponsors,
    ...topics,
  ];
}
