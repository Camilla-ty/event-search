/**
 * Admin display helper for Research Page public URL paths.
 * Year-scoped public routes ship in Phase B; this only builds the intended path string.
 */
export function formatResearchPagePublicPath(
  topicSlug: string,
  regionSlug: string,
  year: number | null = null,
): string {
  const base = `/events/topics/${topicSlug}/regions/${regionSlug}`;
  return year === null ? base : `${base}/${year}`;
}

export function formatResearchPageYearLabel(year: number | null): string {
  return year === null ? "All years" : String(year);
}
