export type PublicEditionTabId =
  | "overview"
  | "sponsors"
  | "venue"
  | "organizers"
  | "partner-alumni";

export function parsePublicEditionTab(
  raw: string | null,
  showPartnerAlumniTab: boolean,
): PublicEditionTabId {
  if (raw === "partner-alumni") {
    return showPartnerAlumniTab ? "partner-alumni" : "overview";
  }
  if (raw === "sponsors" || raw === "venue" || raw === "organizers") return raw;
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
