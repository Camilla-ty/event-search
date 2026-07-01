"use client";

import { BrandWordmark } from "./BrandWordmark";
import { SessionControls } from "./NavigationShell";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";
import type { LayoutMode } from "@/src/lib/layout/layoutMode";

export function BrowseMobileHeader({
  mode,
  session,
}: {
  mode: "marketing" | "app";
  session: MarketingNavSession;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      <BrandWordmark compact />
      <SessionControls mode={mode} session={session} variant="mobile" />
    </div>
  );
}
