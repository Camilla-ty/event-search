/**
 * Research pages are scoped to exactly one location: a Region or a Country.
 * The two kinds live in separate tables (`regions`, `countries`) and get
 * separate public URL segments, so the slug alone is not enough to identify one.
 */

export type ResearchPageLocationType = "region" | "country";

export type ResearchPageLocation = {
  type: ResearchPageLocationType;
  slug: string;
};

export const RESEARCH_PAGE_LOCATION_SEGMENT: Record<
  ResearchPageLocationType,
  string
> = {
  region: "regions",
  country: "countries",
};

export function isResearchPageLocationType(
  value: unknown,
): value is ResearchPageLocationType {
  return value === "region" || value === "country";
}

export function parseResearchPageLocationType(
  raw: unknown,
): ResearchPageLocationType | null {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return isResearchPageLocationType(value) ? value : null;
}

export function researchPageLocationLabel(
  type: ResearchPageLocationType,
): string {
  return type === "country" ? "Country" : "Region";
}
