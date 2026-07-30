/**
 * Shared Research Page public URL path builder.
 * All-years: /events/topics/{topic}/regions/{region}
 * Year-scoped: /events/topics/{topic}/regions/{region}/years/{year}
 */
export function formatResearchPagePublicPath(
  topicSlug: string,
  regionSlug: string,
  year: number | null = null,
): string {
  const base = `/events/topics/${topicSlug}/regions/${regionSlug}`;
  return year === null ? base : `${base}/years/${year}`;
}

export function formatResearchPageYearLabel(year: number | null): string {
  return year === null ? "All years" : String(year);
}
