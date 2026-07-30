/**
 * Whether a Research Page may be published.
 * After Phase B, all-years and year-scoped pages are both publishable.
 */
export function canPublishResearchPage(year: number | null): boolean {
  void year;
  return true;
}

export function assertCanPublishResearchPage(year: number | null): void {
  if (!canPublishResearchPage(year)) {
    throw new Error("This research page cannot be published.");
  }
}
