import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAllowedVenueLogoIngestContentType } from "./venueLogoIngest";

describe("isAllowedVenueLogoIngestContentType", () => {
  it("accepts PNG, JPG, and WebP content types", () => {
    assert.equal(isAllowedVenueLogoIngestContentType("image/png"), true);
    assert.equal(isAllowedVenueLogoIngestContentType("image/jpeg"), true);
    assert.equal(isAllowedVenueLogoIngestContentType("image/jpg"), true);
    assert.equal(isAllowedVenueLogoIngestContentType("image/webp"), true);
    assert.equal(isAllowedVenueLogoIngestContentType("image/png; charset=binary"), true);
  });

  it("rejects SVG, GIF, and other formats", () => {
    assert.equal(isAllowedVenueLogoIngestContentType("image/svg+xml"), false);
    assert.equal(isAllowedVenueLogoIngestContentType("image/gif"), false);
    assert.equal(isAllowedVenueLogoIngestContentType("text/html"), false);
  });
});
