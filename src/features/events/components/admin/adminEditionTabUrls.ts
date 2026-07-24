export type AdminEditionTabId = "profile" | "sponsors" | "exhibitors" | "imports";

export function parseAdminEditionTab(raw: string | null): AdminEditionTabId {
  if (raw === "sponsors" || raw === "exhibitors" || raw === "imports") return raw;
  // Legacy ?tab=organizers (and unknown values) → Profile.
  return "profile";
}

export function buildAdminEditionTabHref(editionId: string, tab: AdminEditionTabId): string {
  return `/admin/events/editions/${editionId}?tab=${tab}`;
}
