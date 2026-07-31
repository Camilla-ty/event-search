import type { BadgeProps } from "@/src/components/common/Badge";
import { normalizeEventExplorerWebsiteHost } from "@/src/features/events/lib/eventExplorerDomain";
import { formatEventLifecycleStatusLabel } from "@/src/lib/validation/eventLifecycleStatus";

/** Hostname-only label for the admin series list Website column. */
export function formatEventSeriesListWebsiteHost(
  websiteUrl: string | null | undefined,
): string | null {
  const host = normalizeEventExplorerWebsiteHost(websiteUrl ?? "");
  return host === "" ? null : host;
}

export type EventSeriesListLifecycleBadge = {
  label: string;
  variant: NonNullable<BadgeProps["variant"]>;
};

/** Lifecycle badge label + variant for the admin series list. */
export function eventSeriesListLifecycleBadge(
  lifecycleStatus: string | null | undefined,
): EventSeriesListLifecycleBadge {
  const trimmed = lifecycleStatus?.trim() ?? "";
  if (trimmed === "") {
    return { label: "Not set", variant: "warning" };
  }

  const label = formatEventLifecycleStatusLabel(trimmed) ?? trimmed;
  switch (trimmed) {
    case "active":
      return { label, variant: "success" };
    case "discontinued":
      return { label, variant: "neutral" };
    case "merged":
      return { label, variant: "default" };
    default:
      return { label, variant: "neutral" };
  }
}
