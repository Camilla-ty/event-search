/**
 * IR3A sponsor profile metadata descriptions.
 * Preference: domain/website → sponsored count → generic.
 *
 * Deliberately does NOT read companies.short_description / companies.description
 * (scheduled for removal — see docs/plans/company-description-removal.md).
 * Never uses industry or gated sponsorship history.
 * @see docs/plans/sponsor-intelligence-seo.md §1.3–1.4
 */

const PRODUCT_LINE = "Company and sponsor intelligence on EventPixels.";
const MAX_DESCRIPTION_CHARS = 155;

export type SponsorMetadataDescriptionInput = {
  name: string;
  website?: string | null;
  domain?: string | null;
  sponsoredEditionCount?: number;
  sponsoredEditionCountUnknown?: boolean;
};

function trimText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed !== "" ? trimmed : null;
}

function normalizeNonNegativeInt(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Prefer domain column; else hostname from website. */
export function resolveSponsorWebsiteLabel(input: {
  website?: string | null;
  domain?: string | null;
}): string | null {
  const domain = trimText(input.domain)?.toLowerCase() ?? null;
  if (domain) return domain;

  const website = trimText(input.website);
  if (!website) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`;
    const host = new URL(withProtocol).hostname
      .replace(/^www\./i, "")
      .toLowerCase();
    return host !== "" ? host : null;
  } catch {
    return null;
  }
}

/** Trim for SERP length; prefer word boundary near the max. */
export function trimSponsorMetadataDescription(
  value: string,
  maxChars: number = MAX_DESCRIPTION_CHARS,
): string {
  const collapsed = collapseWhitespace(value);
  if (collapsed.length <= maxChars) return collapsed;

  const slice = collapsed.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut =
    lastSpace >= Math.floor(maxChars * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[.,;:\s]+$/u, "")}…`;
}

function formatSponsoredEditionCountPhrase(count: number): string {
  const noun = count === 1 ? "event" : "events";
  return `Sponsored ${count} recorded ${noun} on EventPixels.`;
}

/**
 * Build the meta description for a public sponsor profile.
 * Uses only structured, non-gated fields (name, domain/website, sponsored count).
 */
export function buildSponsorMetadataDescription(
  input: SponsorMetadataDescriptionInput,
): string {
  const name = trimText(input.name) || "Sponsor";
  const countUnknown = input.sponsoredEditionCountUnknown === true;
  const count = normalizeNonNegativeInt(input.sponsoredEditionCount);
  const websiteLabel = resolveSponsorWebsiteLabel(input);

  if (websiteLabel) {
    return trimSponsorMetadataDescription(
      `${name} — ${websiteLabel}. ${PRODUCT_LINE}`,
    );
  }

  if (!countUnknown && count >= 1) {
    return trimSponsorMetadataDescription(
      `${name}. ${formatSponsoredEditionCountPhrase(count)}`,
    );
  }

  return trimSponsorMetadataDescription(`${name}. ${PRODUCT_LINE}`);
}
