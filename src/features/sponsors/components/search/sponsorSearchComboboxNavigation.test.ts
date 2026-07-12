import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { buildSponsorDiscoverySearchParams, parseSponsorDiscoveryParamsFromSearchParams } from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import { readSearchParamsFromWindow } from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";
import { buildSponsorSearchUrl } from "@/src/lib/routes/explorerUrls";

describe("SponsorSearchCombobox navigation policy", () => {
  it("uses discovery bridge on /sponsors instead of router.push for search results", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsors/components/search/SponsorSearchCombobox.tsx",
      ),
      "utf8",
    );
    assert.match(source, /isSponsorDiscoveryPage && discoveryBridge !== null/);
    assert.match(source, /discoveryBridge\.submitQuery\(query\)/);
    assert.match(source, /router\.push\(buildSponsorSearchUrl\(query\)\)/);
  });

  it("keeps profile selection as cross-route router.push", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsors/components/search/SponsorSearchCombobox.tsx",
      ),
      "utf8",
    );
    assert.match(source, /router\.push\(href\)/);
    assert.doesNotMatch(source, /router\.replace/);
  });

  it("syncs input from bridge query and popstate", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsors/components/search/SponsorSearchCombobox.tsx",
      ),
      "utf8",
    );
    assert.match(source, /useSponsorDiscoverySearchBridgeConsumer/);
    assert.match(source, /handlePopState/);
    assert.match(source, /readSearchParamsFromWindow/);
    assert.match(source, /discoveryBridge\.query/);
  });
});

describe("Sponsor discovery bridge wiring", () => {
  it("SponsorSearchPage publishes query and setQuery to the bridge", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsors/components/search/SponsorSearchPage.tsx",
      ),
      "utf8",
    );
    assert.match(source, /useSponsorDiscoverySearchBridgePublisher\(params\.query, setQuery\)/);
    assert.match(source, /useSponsorDiscoveryCollection/);
  });

  it("useSponsorDiscoveryCollection exposes setQuery", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsors/client/useSponsorDiscoveryCollection.ts",
      ),
      "utf8",
    );
    assert.match(source, /applySponsorDiscoveryQueryChange/);
    assert.match(source, /setQuery/);
    assert.match(source, /replaceHistoryUrl/);
  });

  it("BrowseMarketingChrome provides sponsor discovery bridge around GlobalSearchBar", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/BrowseMarketingChrome.tsx"),
      "utf8",
    );
    assert.match(source, /SponsorDiscoverySearchBridgeProvider/);
    assert.match(source, /<GlobalSearchBar \/>/);
  });
});

describe("cross-route sponsor search URL", () => {
  it("still builds /sponsors?q= for navigation from non-sponsors routes", () => {
    assert.equal(buildSponsorSearchUrl("acme"), "/sponsors?q=acme");
    assert.equal(buildSponsorSearchUrl(""), "/sponsors");
  });
});

describe("popstate restoration for sponsor search sync", () => {
  it("restores query from window search params", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          search: "?q=restored&event=btc-prague-2026&sort=name&page=2",
        },
      },
    });

    try {
      const restored = parseSponsorDiscoveryParamsFromSearchParams(readSearchParamsFromWindow());
      const href = buildPathWithSearchParams(
        "/sponsors",
        buildSponsorDiscoverySearchParams({ ...restored, pageSize: 20 }),
      );
      assert.equal(href, "/sponsors?q=restored&event=btc-prague-2026&sort=name&page=2");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
