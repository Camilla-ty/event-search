export type PublicEditionTabId =
  | "overview"
  | "sponsors"
  | "exhibitors"
  | "venue"
  | "organizers"
  | "partner-alumni";

export type PublicEditionTabVisibility = {
  showSponsorsTab: boolean;
  showExhibitorsTab: boolean;
  showPartnerAlumniTab: boolean;
};

export function parsePublicEditionTab(
  raw: string | null,
  visibility: PublicEditionTabVisibility,
): PublicEditionTabId {
  if (raw === "sponsors") {
    return visibility.showSponsorsTab ? "sponsors" : "overview";
  }
  if (raw === "exhibitors") {
    return visibility.showExhibitorsTab ? "exhibitors" : "overview";
  }
  if (raw === "partner-alumni") {
    return visibility.showPartnerAlumniTab ? "partner-alumni" : "overview";
  }
  if (raw === "venue" || raw === "organizers") return raw;
  return "overview";
}

export function buildPublicEditionTabHref(
  eventSlug: string,
  tab: PublicEditionTabId,
): string {
  const trimmed = eventSlug.trim();
  const basePath = `/events/${encodeURIComponent(trimmed)}`;
  return tab === "overview" ? basePath : `${basePath}?tab=${tab}`;
}
