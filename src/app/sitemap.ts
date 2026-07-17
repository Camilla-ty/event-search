import type { MetadataRoute } from "next";

import {
  buildStaticSitemapEntries,
  fetchBitcoinAsiaHubSitemapEntries,
  fetchPublicCompanySitemapEntries,
  fetchPublicEventEditionSitemapEntries,
  fetchPublicEventSeriesSitemapEntries,
  fetchPublicTopicSitemapEntries,
} from "@/src/lib/seo/sitemapEntries";

/** Refresh catalog URLs periodically without regenerating on every request. */
export const revalidate = 3600;

/**
 * IR1: sitemap membership ⇔ indexable under indexability-policy.
 * IR4 MVP: Bitcoin × Asia included only when the hub public-value gate passes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [editions, series, sponsors, topics, bitcoinAsiaHub] = await Promise.all([
    fetchPublicEventEditionSitemapEntries(),
    fetchPublicEventSeriesSitemapEntries(),
    fetchPublicCompanySitemapEntries(),
    fetchPublicTopicSitemapEntries(),
    fetchBitcoinAsiaHubSitemapEntries(),
  ]);

  return [
    ...buildStaticSitemapEntries(),
    ...bitcoinAsiaHub,
    ...editions,
    ...series,
    ...sponsors,
    ...topics,
  ];
}
