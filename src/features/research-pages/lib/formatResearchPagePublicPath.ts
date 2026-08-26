import {
  RESEARCH_PAGE_LOCATION_SEGMENT,
  type ResearchPageLocation,
} from "@/src/features/research-pages/lib/researchPageLocation";

/**
 * Shared Research Page public URL path builder.
 * All-years: /events/topics/{topic}/{regions|countries}/{location}
 * Year-scoped: /events/topics/{topic}/{regions|countries}/{location}/years/{year}
 */
export function formatResearchPagePublicPath(
  topicSlug: string,
  location: ResearchPageLocation,
  year: number | null = null,
): string {
  const segment = RESEARCH_PAGE_LOCATION_SEGMENT[location.type];
  const base = `/events/topics/${topicSlug}/${segment}/${location.slug}`;
  return year === null ? base : `${base}/years/${year}`;
}

export function formatResearchPageYearLabel(year: number | null): string {
  return year === null ? "All years" : String(year);
}
