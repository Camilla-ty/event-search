"use client";

import type { ReactNode } from "react";

import { EventExplorerFilterBridgeProvider } from "@/src/features/events/client/EventExplorerFilterBridge";
import { SponsorDiscoverySearchBridgeProvider } from "@/src/features/sponsors/client/SponsorDiscoverySearchBridge";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";
import { getLayoutTokens } from "@/src/lib/layout/layoutTokens";

import { BrowseMobileHeader } from "./BrowseMobileHeader";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { MobilePrimaryNav } from "./MobilePrimaryNav";

type BrowseMarketingChromeProps = {
  mode: "marketing" | "app";
  session: MarketingNavSession;
  children: ReactNode;
};

export function BrowseMarketingChrome({
  mode,
  session,
  children,
}: BrowseMarketingChromeProps) {
  const tokens = getLayoutTokens(mode);

  return (
    <EventExplorerFilterBridgeProvider>
      <SponsorDiscoverySearchBridgeProvider>
        <BrowseMobileHeader mode={mode} session={session} />
        <MobilePrimaryNav />
        <header className={tokens.searchHeader}>
          <GlobalSearchBar />
        </header>
        <main id="main-content" className={tokens.main}>
          <div className={tokens.page}>{children}</div>
        </main>
      </SponsorDiscoverySearchBridgeProvider>
    </EventExplorerFilterBridgeProvider>
  );
}
