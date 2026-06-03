import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";
import type { LayoutMode } from "@/src/lib/layout/layoutMode";

/** Authenticated browse experience (sidebar + session, no guest CTAs). */
export function resolveBrowseLayoutMode(
  session: MarketingNavSession,
): "marketing" | "app" {
  return session.isAuthenticated ? "app" : "marketing";
}
