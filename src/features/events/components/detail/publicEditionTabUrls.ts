export type PublicEditionTabId =
  | "overview"
  | "sponsors"
  | "venue"
  | "organizers"
  | "partner-alumni";

export function buildPublicEditionTabHref(
  eventSlug: string,
  tab: PublicEditionTabId,
): string {
  const trimmed = eventSlug.trim();
  const basePath = `/events/${encodeURIComponent(trimmed)}`;
  return tab === "overview" ? basePath : `${basePath}?tab=${tab}`;
}
