import type { ReactNode } from "react";

import { getLayoutTokens } from "@/src/lib/layout/layoutTokens";
import type { LayoutMode } from "@/src/lib/layout/layoutMode";
import { isSidebarLayoutMode } from "@/src/lib/layout/layoutMode";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";

import { BrowseMobileHeader } from "./BrowseMobileHeader";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { MobilePrimaryNav } from "./MobilePrimaryNav";
import { NavigationShell } from "./NavigationShell";
import { SkipLink } from "./SkipLink";

export type LayoutShellProps = {
  mode: LayoutMode;
  session: MarketingNavSession;
  children: ReactNode;
  adminEmail?: string | null;
};

export function LayoutShell({
  mode,
  session,
  children,
  adminEmail,
}: LayoutShellProps) {
  const tokens = getLayoutTokens(mode);

  if (mode === "auth") {
    return (
      <div className={tokens.shell}>
        <SkipLink />
        <div className={`min-h-screen ${tokens.contentColumn}`}>
          <main id="main-content" className={tokens.main}>
            <div className={tokens.page}>{children}</div>
          </main>
        </div>
      </div>
    );
  }

  if (mode === "admin") {
    return (
      <div className={tokens.shell}>
        <SkipLink />
        <NavigationShell mode={mode} session={session} adminEmail={adminEmail} />
        <div className={tokens.contentColumn}>
          <main id="main-content" className={tokens.main}>
            <div className={tokens.page}>{children}</div>
          </main>
        </div>
      </div>
    );
  }

  if (isSidebarLayoutMode(mode)) {
    return (
      <div className={tokens.shell}>
        <SkipLink />
        <NavigationShell mode={mode} session={session} />
        <div className={tokens.contentColumn}>
          <BrowseMobileHeader mode={mode} session={session} />
          <MobilePrimaryNav />
          <header className={tokens.searchHeader}>
            <GlobalSearchBar />
          </header>
          <main id="main-content" className={tokens.main}>
            <div className={tokens.page}>{children}</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={tokens.shell}>
      <main id="main-content" className={tokens.main}>
        <div className={tokens.page}>{children}</div>
      </main>
    </div>
  );
}
