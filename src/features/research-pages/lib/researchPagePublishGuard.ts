/** Shown in Admin UI and returned by the publish API for year-scoped pages. */
export const YEAR_SCOPED_PUBLISH_BLOCKED_MESSAGE =
  "Year-specific pages can be published after the public year route is implemented.";

/** Phase A: only all-years pages (year = null) may be published. */
export function canPublishResearchPage(year: number | null): boolean {
  return year === null;
}

export function assertCanPublishResearchPage(year: number | null): void {
  if (!canPublishResearchPage(year)) {
    throw new Error(YEAR_SCOPED_PUBLISH_BLOCKED_MESSAGE);
  }
}
