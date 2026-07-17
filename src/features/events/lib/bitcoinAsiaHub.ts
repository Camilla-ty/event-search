/**
 * Bitcoin × Asia TopicRegionHub — MVP constants and pure copy helpers.
 * Hardcoded to one hub; not a generic topic/region platform.
 * @see docs/plans/ir4-bitcoin-asia-mvp.md
 */

export const BITCOIN_ASIA_TOPIC_SLUG = "bitcoin";
export const BITCOIN_ASIA_REGION_SLUG = "asia";
export const BITCOIN_ASIA_HUB_PATH = "/events/topics/bitcoin/regions/asia";

export const BITCOIN_ASIA_MIN_INDEXABLE_EVENTS = 3;
export const BITCOIN_ASIA_MIN_SPONSORS = 5;
export const BITCOIN_ASIA_SPONSOR_DISPLAY_LIMIT = 20;

export type BitcoinAsiaHubFacts = {
  topicName: string;
  regionName: string;
  eventCount: number;
  indexableEventCount: number;
  seriesCount: number;
  yearMin: number | null;
  yearMax: number | null;
  countryNames: readonly string[];
  distinctSponsorCount: number;
};

export function bitcoinAsiaHubPassesGate(input: {
  indexableEventCount: number;
  distinctSponsorCount: number;
}): boolean {
  return (
    input.indexableEventCount >= BITCOIN_ASIA_MIN_INDEXABLE_EVENTS &&
    input.distinctSponsorCount >= BITCOIN_ASIA_MIN_SPONSORS
  );
}

export function joinCountryNames(names: readonly string[]): string {
  const cleaned = names.map((n) => n.trim()).filter((n) => n !== "");
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0]!;
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

export function formatYearSpan(
  yearMin: number | null,
  yearMax: number | null,
): string | null {
  if (yearMin === null && yearMax === null) return null;
  if (yearMin !== null && yearMax !== null) {
    if (yearMin === yearMax) return String(yearMin);
    return `${yearMin}–${yearMax}`;
  }
  return String(yearMin ?? yearMax);
}

/** Four-sentence factual summary (sponsor-first). */
export function buildBitcoinAsiaHubSummary(facts: BitcoinAsiaHubFacts): string | null {
  if (facts.distinctSponsorCount < 1) return null;

  const yearSpan = formatYearSpan(facts.yearMin, facts.yearMax);
  const countries = joinCountryNames(facts.countryNames);
  if (!yearSpan || countries === "") return null;

  const brandClause =
    facts.seriesCount > 1
      ? ` spanning ${facts.seriesCount} event brands in ${countries}`
      : ` in ${countries}`;

  const sentences = [
    `${facts.distinctSponsorCount} sponsoring companies are recorded on ${facts.topicName} events in ${facts.regionName} on EventPixels.`,
    `They appear across ${facts.eventCount} ${facts.topicName} events (${yearSpan})${brandClause}.`,
    `${facts.indexableEventCount} events have public sponsor rosters.`,
    "Counts reflect EventPixels-recorded sponsorship data.",
  ];

  return sentences.join(" ");
}

export function buildBitcoinAsiaHubMetaDescription(facts: BitcoinAsiaHubFacts): string {
  const yearSpan = formatYearSpan(facts.yearMin, facts.yearMax) ?? "";
  const countries = joinCountryNames(facts.countryNames);
  const yearPart = yearSpan !== "" ? ` (${yearSpan})` : "";
  const countryPart = countries !== "" ? ` across ${countries}` : "";

  return `EventPixels records ${facts.eventCount} ${facts.topicName} events in ${facts.regionName}${yearPart}${countryPart}, with ${facts.distinctSponsorCount} companies recorded as sponsors of those events.`;
}

export function buildBitcoinAsiaHubTitle(topicName: string, regionName: string): string {
  return `${topicName} Events in ${regionName}`;
}

/** Hub last-reviewed display: "8 July 2026". */
export function formatBitcoinAsiaHubLastReviewed(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
