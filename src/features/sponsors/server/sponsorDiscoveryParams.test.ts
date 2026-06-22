import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSponsorDiscoveryPath,
  clampSponsorDiscoveryPage,
  parseSponsorDiscoveryEventSlug,
  parseSponsorDiscoveryPage,
  parseSponsorDiscoveryPageSize,
  parseSponsorDiscoveryParams,
  parseSponsorDiscoveryQuery,
  parseSponsorDiscoverySort,
  SPONSOR_DISCOVERY_DEFAULT_PAGE_SIZE,
  SPONSOR_DISCOVERY_MAX_QUERY_LENGTH,
  sponsorDiscoveryTotalPages,
} from "@/src/features/sponsors/server/sponsorDiscoveryParams";

describe("parseSponsorDiscoveryQuery", () => {
  it("trims query text", () => {
    assert.equal(parseSponsorDiscoveryQuery("  acme  "), "acme");
  });

  it("truncates long queries", () => {
    const long = "a".repeat(SPONSOR_DISCOVERY_MAX_QUERY_LENGTH + 10);
    assert.equal(parseSponsorDiscoveryQuery(long).length, SPONSOR_DISCOVERY_MAX_QUERY_LENGTH);
  });
});

describe("parseSponsorDiscoveryEventSlug", () => {
  it("returns null for empty values", () => {
    assert.equal(parseSponsorDiscoveryEventSlug(""), null);
    assert.equal(parseSponsorDiscoveryEventSlug("   "), null);
    assert.equal(parseSponsorDiscoveryEventSlug(null), null);
  });

  it("returns trimmed slug", () => {
    assert.equal(parseSponsorDiscoveryEventSlug("  btc-prague-2026  "), "btc-prague-2026");
  });
});

describe("parseSponsorDiscoverySort", () => {
  it("defaults to activity", () => {
    assert.equal(parseSponsorDiscoverySort(undefined, false), "activity");
    assert.equal(parseSponsorDiscoverySort("invalid", false), "activity");
  });

  it("coerces tier to activity without event filter", () => {
    assert.equal(parseSponsorDiscoverySort("tier", false), "activity");
  });

  it("allows tier with event filter", () => {
    assert.equal(parseSponsorDiscoverySort("tier", true), "tier");
  });

  it("accepts name and count", () => {
    assert.equal(parseSponsorDiscoverySort("name", false), "name");
    assert.equal(parseSponsorDiscoverySort("count", false), "count");
  });
});

describe("parseSponsorDiscoveryPage", () => {
  it("defaults invalid values to 1", () => {
    assert.equal(parseSponsorDiscoveryPage(undefined), 1);
    assert.equal(parseSponsorDiscoveryPage("abc"), 1);
    assert.equal(parseSponsorDiscoveryPage(0), 1);
    assert.equal(parseSponsorDiscoveryPage(-3), 1);
  });

  it("accepts valid numeric pages", () => {
    assert.equal(parseSponsorDiscoveryPage("2"), 2);
    assert.equal(parseSponsorDiscoveryPage(3), 3);
  });
});

describe("parseSponsorDiscoveryPageSize", () => {
  it("defaults invalid values to 20", () => {
    assert.equal(parseSponsorDiscoveryPageSize(undefined), SPONSOR_DISCOVERY_DEFAULT_PAGE_SIZE);
    assert.equal(parseSponsorDiscoveryPageSize("abc"), SPONSOR_DISCOVERY_DEFAULT_PAGE_SIZE);
    assert.equal(parseSponsorDiscoveryPageSize(0), SPONSOR_DISCOVERY_DEFAULT_PAGE_SIZE);
  });

  it("clamps to max page size", () => {
    assert.equal(parseSponsorDiscoveryPageSize(500), SPONSOR_DISCOVERY_DEFAULT_PAGE_SIZE);
    assert.equal(parseSponsorDiscoveryPageSize("100"), 100);
  });
});

describe("parseSponsorDiscoveryParams", () => {
  it("normalizes q and event aliases", () => {
    const params = parseSponsorDiscoveryParams({
      q: "  ckma ",
      event: " btc-prague-2026 ",
      sort: "name",
      page: "2",
      pageSize: "50",
    });

    assert.deepEqual(params, {
      query: "ckma",
      eventSlug: "btc-prague-2026",
      sort: "name",
      page: 2,
      pageSize: 50,
    });
  });

  it("prefers q over query", () => {
    const params = parseSponsorDiscoveryParams({
      q: "from-q",
      query: "from-query",
    });
    assert.equal(params.query, "from-q");
  });
});

describe("sponsorDiscoveryTotalPages", () => {
  it("computes pages from total and page size", () => {
    assert.equal(sponsorDiscoveryTotalPages(0, 20), 1);
    assert.equal(sponsorDiscoveryTotalPages(1226, 20), 62);
    assert.equal(sponsorDiscoveryTotalPages(20, 20), 1);
    assert.equal(sponsorDiscoveryTotalPages(21, 20), 2);
  });
});

describe("clampSponsorDiscoveryPage", () => {
  it("clamps out-of-range pages to the last valid page", () => {
    assert.equal(clampSponsorDiscoveryPage(9999, 1226, 20), 62);
    assert.equal(clampSponsorDiscoveryPage(2, 1226, 20), 2);
    assert.equal(clampSponsorDiscoveryPage(1, 1226, 20), 1);
  });
});

describe("buildSponsorDiscoveryPath", () => {
  it("omits default params from the path", () => {
    assert.equal(
      buildSponsorDiscoveryPath({
        query: "",
        eventSlug: null,
        sort: "activity",
        page: 1,
        pageSize: 20,
      }),
      "/sponsors",
    );
  });

  it("includes non-default params", () => {
    assert.equal(
      buildSponsorDiscoveryPath({
        query: "acme",
        eventSlug: "btc-prague-2026",
        sort: "name",
        page: 2,
        pageSize: 20,
      }),
      "/sponsors?q=acme&event=btc-prague-2026&sort=name&page=2",
    );
  });
});
