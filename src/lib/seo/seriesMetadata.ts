/**
 * Series hub meta descriptions from the factual summary engine.
 * No curated/AI description column — trim the structural summary for SERP length.
 */

import {
  buildEventSeriesSummary,
  type EventSeriesSummaryInput,
} from "@/src/lib/content/factualSummary";
import { trimSponsorMetadataDescription } from "@/src/lib/seo/sponsorMetadata";

const FALLBACK_SUFFIX = "events from this event brand on EventPixels.";

export type SeriesMetadataDescriptionInput = EventSeriesSummaryInput;

/**
 * Build the meta description for a public event series hub.
 * Prefers a length-capped factual summary; falls back to a name template.
 */
export function buildSeriesMetadataDescription(
  input: SeriesMetadataDescriptionInput,
): string {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const safeName = name !== "" ? name : "Event brand";
  const summary = buildEventSeriesSummary(input);
  if (summary) {
    return trimSponsorMetadataDescription(summary);
  }
  return trimSponsorMetadataDescription(`${safeName} — ${FALLBACK_SUFFIX}`);
}
