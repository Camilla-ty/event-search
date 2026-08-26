/**
 * Topic × Region hub — quality-gate thresholds and pure copy helpers.
 * Shared by the public hub routes, the Admin preview, and sitemap inclusion.
 */

export const TOPIC_REGION_HUB_MIN_INDEXABLE_EVENTS = 3;
export const TOPIC_REGION_HUB_MIN_SPONSORS = 5;
export const TOPIC_REGION_HUB_SPONSOR_DISPLAY_LIMIT = 20;

export type TopicRegionHubFacts = {
  topicName: string;
  /** Region or Country display name, depending on the page's location kind. */
  locationName: string;
  eventCount: number;
  indexableEventCount: number;
  seriesCount: number;
  yearMin: number | null;
  yearMax: number | null;
  countryNames: readonly string[];
  distinctSponsorCount: number;
};

export function topicRegionHubPassesGate(input: {
  indexableEventCount: number;
  distinctSponsorCount: number;
}): boolean {
  return (
    input.indexableEventCount >= TOPIC_REGION_HUB_MIN_INDEXABLE_EVENTS &&
    input.distinctSponsorCount >= TOPIC_REGION_HUB_MIN_SPONSORS
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
export function buildTopicRegionHubSummary(
  facts: TopicRegionHubFacts,
): string | null {
  if (facts.distinctSponsorCount < 1) return null;

  const yearSpan = formatYearSpan(facts.yearMin, facts.yearMax);
  const countries = joinCountryNames(facts.countryNames);
  if (!yearSpan || countries === "") return null;

  const brandClause =
    facts.seriesCount > 1
      ? ` spanning ${facts.seriesCount} event brands in ${countries}`
      : ` in ${countries}`;

  const sentences = [
    `${facts.distinctSponsorCount} sponsoring companies are recorded on ${facts.topicName} events in ${facts.locationName} on EventPixels.`,
    `They appear across ${facts.eventCount} ${facts.topicName} events (${yearSpan})${brandClause}.`,
    `${facts.indexableEventCount} events have public sponsor rosters.`,
    "Counts reflect EventPixels-recorded sponsorship data.",
  ];

  return sentences.join(" ");
}

export function buildTopicRegionHubMetaDescription(
  facts: TopicRegionHubFacts,
): string {
  const yearSpan = formatYearSpan(facts.yearMin, facts.yearMax) ?? "";
  const countries = joinCountryNames(facts.countryNames);
  const yearPart = yearSpan !== "" ? ` (${yearSpan})` : "";
  const countryPart = countries !== "" ? ` across ${countries}` : "";

  return `EventPixels records ${facts.eventCount} ${facts.topicName} events in ${facts.locationName}${yearPart}${countryPart}, with ${facts.distinctSponsorCount} companies recorded as sponsors of those events.`;
}

export function buildTopicRegionHubTitle(
  topicName: string,
  locationName: string,
  year?: number | null,
): string {
  const base = `${topicName} Events in ${locationName}`;
  return typeof year === "number" ? `${base} (${year})` : base;
}

/** Hub last-reviewed display: "8 July 2026". */
export function formatTopicRegionHubLastReviewed(
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
