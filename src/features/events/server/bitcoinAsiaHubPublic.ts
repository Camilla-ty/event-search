import {
  BITCOIN_ASIA_HUB_PATH,
  BITCOIN_ASIA_REGION_SLUG,
  BITCOIN_ASIA_TOPIC_SLUG,
  type BitcoinAsiaHubFacts,
} from "@/src/features/events/lib/bitcoinAsiaHub";
import { getTopicRegionHubPageData } from "@/src/features/events/server/topicRegionHubData";

export type BitcoinAsiaHubEventCard = {
  id: string;
  slug: string;
  name: string;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
  dateLabel: string | null;
  locationLabel: string;
  countryName: string;
  seriesName: string | null;
  seriesSlug: string | null;
  sponsorCount: number;
  lastReviewedAt: string | null;
  lastReviewedLabel: string | null;
};

export type BitcoinAsiaHubSponsorRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  hubEventCount: number;
  globalEditionCount: number;
  publicHref: string | null;
};

export type BitcoinAsiaHubPageData = {
  path: string;
  title: string;
  metaDescription: string;
  h1: string;
  summary: string;
  lastReviewedAt: string | null;
  lastReviewedLabel: string | null;
  facts: BitcoinAsiaHubFacts;
  events: BitcoinAsiaHubEventCard[];
  sponsors: BitcoinAsiaHubSponsorRow[];
  totalSponsorCount: number;
  topicHubPath: string;
};

/**
 * Bitcoin × Asia public page loader.
 * Delegates to the generic Topic × Region loader but enforces the
 * indexability gate — returns null when the gate fails, preserving
 * the exact behavior the public route and sitemap depend on.
 */
export async function getBitcoinAsiaHubPageData(): Promise<BitcoinAsiaHubPageData | null> {
  const generic = await getTopicRegionHubPageData(
    BITCOIN_ASIA_TOPIC_SLUG,
    BITCOIN_ASIA_REGION_SLUG,
  );

  if (!generic) return null;
  if (!generic.passesGate) return null;
  if (generic.summary === null) return null;

  return {
    path: BITCOIN_ASIA_HUB_PATH,
    title: generic.title,
    metaDescription: generic.metaDescription,
    h1: generic.h1,
    summary: generic.summary,
    lastReviewedAt: generic.lastReviewedAt,
    lastReviewedLabel: generic.lastReviewedLabel,
    facts: generic.facts,
    events: generic.events,
    sponsors: generic.sponsors,
    totalSponsorCount: generic.totalSponsorCount,
    topicHubPath: generic.topicHubPath,
  };
}
