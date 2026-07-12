import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSponsorDiscoveryApiUrl } from "@/src/features/sponsors/client/sponsorDiscoveryApiUrl";
import {
  applySponsorDiscoveryClearEventScope,
  applySponsorDiscoveryPageChange,
  applySponsorDiscoveryQueryChange,
  applySponsorDiscoverySortChange,
  shouldApplySponsorDiscoveryFetchResult,
} from "@/src/features/sponsors/client/sponsorDiscoveryCollectionState";
import {
  buildSponsorDiscoveryParamsKey,
  buildSponsorDiscoveryPath,
  buildSponsorDiscoverySearchParams,
  parseSponsorDiscoveryParamsFromSearchParams,
  SPONSOR_DISCOVERY_DEFAULT_SORT,
} from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import type { SponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

const baseParams: SponsorDiscoveryParams = {
  query: "acme",
  eventSlug: "btc-prague-2026",
  sort: "name",
  page: 2,
  pageSize: 20,
};

describe("buildSponsorDiscoveryApiUrl", () => {
  it("maps normalized params to the discovery API route", () => {
    assert.equal(
      buildSponsorDiscoveryApiUrl(baseParams),
      "/api/sponsors/discovery?q=acme&event=btc-prague-2026&sort=name&page=2",
    );
  });

  it("matches the sponsors page path query string", () => {
    const apiUrl = buildSponsorDiscoveryApiUrl(baseParams);
    const pagePath = buildSponsorDiscoveryPath(baseParams);
    assert.equal(apiUrl, `/api/sponsors/discovery?${pagePath.split("?")[1]}`);
  });
});

describe("sponsor discovery collection state helpers", () => {
  it("resets page when sort changes", () => {
    const next = applySponsorDiscoverySortChange(baseParams, "activity");
    assert.equal(next.sort, "activity");
    assert.equal(next.page, 1);
    assert.equal(next.query, "acme");
  });

  it("clears event scope and demotes tier sort", () => {
    const tierParams: SponsorDiscoveryParams = {
      ...baseParams,
      sort: "tier",
    };
    const next = applySponsorDiscoveryClearEventScope(tierParams);
    assert.equal(next.eventSlug, null);
    assert.equal(next.sort, SPONSOR_DISCOVERY_DEFAULT_SORT);
    assert.equal(next.page, 1);
  });

  it("updates page without changing other filters", () => {
    const next = applySponsorDiscoveryPageChange(baseParams, 3);
    assert.equal(next.page, 3);
    assert.equal(next.sort, "name");
    assert.equal(next.eventSlug, "btc-prague-2026");
  });

  it("updates query, resets page, and preserves event scope", () => {
    const next = applySponsorDiscoveryQueryChange(baseParams, "  beta  ");
    assert.equal(next.query, "beta");
    assert.equal(next.page, 1);
    assert.equal(next.eventSlug, "btc-prague-2026");
    assert.equal(next.sort, "name");
  });

  it("clears q from serialized params when query is empty", () => {
    const next = applySponsorDiscoveryQueryChange(baseParams, "   ");
    assert.equal(next.query, "");
    const serialized = buildSponsorDiscoverySearchParams(next);
    assert.equal(serialized.has("q"), false);
    assert.equal(serialized.get("event"), "btc-prague-2026");
  });

  it("demotes tier sort when event scope is absent", () => {
    const tierParams: SponsorDiscoveryParams = {
      query: "",
      eventSlug: null,
      sort: "tier",
      page: 4,
      pageSize: 20,
    };
    const next = applySponsorDiscoveryQueryChange(tierParams, "acme");
    assert.equal(next.sort, SPONSOR_DISCOVERY_DEFAULT_SORT);
    assert.equal(next.page, 1);
    assert.equal(next.query, "acme");
  });

  it("does not change params key when query is unchanged and page already 1", () => {
    const params: SponsorDiscoveryParams = {
      query: "acme",
      eventSlug: "btc-prague-2026",
      sort: "name",
      page: 1,
      pageSize: 20,
    };
    const next = applySponsorDiscoveryQueryChange(params, "acme");
    assert.equal(
      buildSponsorDiscoveryParamsKey(next),
      buildSponsorDiscoveryParamsKey(params),
    );
  });

  it("ignores stale fetch responses by request id", () => {
    assert.equal(shouldApplySponsorDiscoveryFetchResult(1, 2), false);
    assert.equal(shouldApplySponsorDiscoveryFetchResult(2, 2), true);
  });
});

describe("URL round trip", () => {
  it("parses search params into the same params key", () => {
    const params = parseSponsorDiscoveryParamsFromSearchParams(
      new URLSearchParams("q=acme&event=btc-prague-2026&sort=name&page=2"),
    );
    assert.equal(buildSponsorDiscoveryParamsKey(params), "q=acme&event=btc-prague-2026&sort=name&page=2");
  });
});

describe("SponsorSearchPage navigation policy", () => {
  it("does not import next/navigation router APIs", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../components/search/SponsorSearchPage.tsx", import.meta.url),
      "utf8",
    );

    assert.doesNotMatch(source, /useRouter/);
    assert.doesNotMatch(source, /router\.(replace|push|refresh)/);
    assert.doesNotMatch(source, /useSearchParams/);
    assert.match(source, /useSponsorDiscoveryCollection/);
  });
});
