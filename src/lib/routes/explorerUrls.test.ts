import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSponsorProfilePath, buildVenuePath } from "./explorerUrls";

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
