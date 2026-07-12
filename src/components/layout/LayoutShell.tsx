import type { ReactNode } from "react";

import { getLayoutTokens } from "@/src/lib/layout/layoutTokens";
import type { LayoutMode } from "@/src/lib/layout/layoutMode";
import { isSidebarLayoutMode } from "@/src/lib/layout/layoutMode";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";

import { AdminShell } from "@/src/features/admin/components/AdminShell";

import { BrowseMarketingChrome } from "./BrowseMarketingChrome";
import { MarketingBrowseAuthBoundary } from "./MarketingBrowseAuthBoundary";
import { NavigationShell } from "./NavigationShell";
import { PublicMobileDesktopNotice } from "./PublicMobileDesktopNotice";
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
        <AdminShell session={session} adminEmail={adminEmail}>
          {children}
        </AdminShell>
      </div>
    );
  }

  if (isSidebarLayoutMode(mode)) {
    return (
      <div className={tokens.shell}>
        <SkipLink />
        <MarketingBrowseAuthBoundary session={session}>
          <NavigationShell mode={mode} session={session} />
          <div className={tokens.contentColumn}>
            <BrowseMarketingChrome mode={mode} session={session}>
              {children}
            </BrowseMarketingChrome>
            <PublicMobileDesktopNotice />
          </div>
        </MarketingBrowseAuthBoundary>
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
