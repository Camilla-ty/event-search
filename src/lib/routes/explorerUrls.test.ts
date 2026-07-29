import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEventExplorerMonthUrl,
  buildEventExplorerRecentlyReviewedUrl,
  buildSponsorProfilePath,
  buildVenuePath,
  getEventExplorerMonthDateBounds,
} from "./explorerUrls";

describe("buildEventExplorerRecentlyReviewedUrl", () => {
  it("opens the Event Explorer with Recently Reviewed selected", () => {
    assert.equal(buildEventExplorerRecentlyReviewedUrl(), "/events?sort=reviewed");
  });
});

describe("buildEventExplorerMonthUrl", () => {
  it("filters Explorer to a 31-day month", () => {
    assert.equal(
      buildEventExplorerMonthUrl("2027-01"),
      "/events?start=2027-01-01&end=2027-01-31",
    );
  });

  it("filters Explorer to a 30-day month", () => {
    assert.equal(
      buildEventExplorerMonthUrl("2027-09"),
      "/events?start=2027-09-01&end=2027-09-30",
    );
  });

  it("filters Explorer to February in a leap year", () => {
    assert.equal(
      buildEventExplorerMonthUrl("2024-02"),
      "/events?start=2024-02-01&end=2024-02-29",
    );
  });

  it("returns null for invalid months", () => {
    assert.equal(buildEventExplorerMonthUrl("2027-13"), null);
    assert.equal(buildEventExplorerMonthUrl("not-a-month"), null);
  });
});

describe("getEventExplorerMonthDateBounds", () => {
  it("matches getMonthStartEnd-style inclusive bounds", () => {
    assert.deepEqual(getEventExplorerMonthDateBounds("2026-04"), {
      start: "2026-04-01",
      end: "2026-04-30",
    });
    assert.deepEqual(getEventExplorerMonthDateBounds("2028-02"), {
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });
});

describe("buildSponsorProfilePath", () => {
  it("returns null for restricted companies by default", () => {
    assert.equal(
      buildSponsorProfilePath({ slug: "acme", id: "1", restricted_at: "2026-07-11T00:00:00.000Z" }),
      null,
    );
  });

  it("allows restricted profile paths when explicitly opted in", () => {
    assert.equal(
      buildSponsorProfilePath(
        { slug: "acme", id: "1", restricted_at: "2026-07-11T00:00:00.000Z" },
        { allowRestricted: true },
      ),
      "/sponsors/acme",
    );
  });

  it("returns profile path for public companies", () => {
    assert.equal(buildSponsorProfilePath({ slug: "acme", id: "1", restricted_at: null }), "/sponsors/acme");
  });
});

describe("buildVenuePath", () => {
  it("prefers slug over id", () => {
    assert.equal(
      buildVenuePath({ slug: "marina-bay-sands", id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5" }),
      "/venues/marina-bay-sands",
    );
  });

  it("falls back to id when slug is missing", () => {
    assert.equal(
      buildVenuePath({ slug: "", id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5" }),
      "/venues/8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
    );
  });

  it("returns null when slug and id are both empty", () => {
    assert.equal(buildVenuePath({ slug: "  ", id: null }), null);
  });
});
