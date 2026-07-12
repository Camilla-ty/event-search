import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { primaryNavItems } from "@/src/lib/constants/navigation";

describe("sidebar cross-route navigation", () => {
  it("SidebarNavItem uses Next.js Link without click interception", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/SidebarNavItem.tsx"),
      "utf8",
    );
    assert.match(source, /<Link/);
    assert.match(source, /href=\{href\}/);
    assert.equal(source.includes("preventDefault"), false);
    assert.equal(source.includes("onClick"), false);
  });

  it("primary nav items include Discover, Events, and Sponsors routes", () => {
    const hrefs = primaryNavItems.map((item) => item.href);
    assert.deepEqual(hrefs, ["/", "/events", "/sponsors"]);
  });

  it("NavigationShell renders sidebar links for desktop and mobile chrome separately", () => {
    const navigationShell = readFileSync(
      path.join(process.cwd(), "src/components/layout/NavigationShell.tsx"),
      "utf8",
    );
    const mobileHeader = readFileSync(
      path.join(process.cwd(), "src/components/layout/BrowseMobileHeader.tsx"),
      "utf8",
    );
    const mobileNav = readFileSync(
      path.join(process.cwd(), "src/components/layout/MobilePrimaryNav.tsx"),
      "utf8",
    );

    assert.match(navigationShell, /SidebarNavItem/);
    assert.match(mobileNav, /<Link/);
    assert.match(mobileNav, /primaryNavItems/);
    assert.doesNotMatch(mobileHeader, /SidebarNavItem/);
  });

  it("does not wrap sidebar links in bridge providers", () => {
    const browseChrome = readFileSync(
      path.join(process.cwd(), "src/components/layout/BrowseMarketingChrome.tsx"),
      "utf8",
    );
    const layoutShell = readFileSync(
      path.join(process.cwd(), "src/components/layout/LayoutShell.tsx"),
      "utf8",
    );

    assert.doesNotMatch(browseChrome, /SidebarNavItem/);
    assert.match(layoutShell, /<NavigationShell mode=\{mode\} session=\{session\} \/>/);
    assert.match(layoutShell, /<BrowseMarketingChrome/);
  });
});

describe("same-page search optimization remains intact", () => {
  it("GlobalSearchBar uses Event Explorer bridge on /events", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/GlobalSearchBar.tsx"),
      "utf8",
    );
    assert.match(source, /if \(isEventExplorerPage && eventExplorerBridge !== null\)/);
    assert.match(source, /eventExplorerBridge\.setFilters/);
  });

  it("SponsorSearchCombobox uses discovery bridge on /sponsors", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsors/components/search/SponsorSearchCombobox.tsx",
      ),
      "utf8",
    );
    assert.match(source, /if \(isSponsorDiscoveryPage && discoveryBridge !== null\)/);
    assert.match(source, /discoveryBridge\.submitQuery\(query\)/);
  });

  it("Sponsor discovery collection uses targeted fetch instead of router navigation", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsors/client/useSponsorDiscoveryCollection.ts",
      ),
      "utf8",
    );
    assert.match(source, /fetchSponsorDiscoveryCollection/);
    assert.equal(source.includes("router.push"), false);
    assert.match(source, /canOwnerSyncHistoryUrl/);
  });
});
