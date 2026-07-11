import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSponsorProfilePath } from "./explorerUrls";

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
