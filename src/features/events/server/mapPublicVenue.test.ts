import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  editionHasVenueId,
  mapPublicVenueFromEditionRow,
} from "./mapPublicVenue";

describe("mapPublicVenueFromEditionRow", () => {
  it("returns null when venue_id is not set", () => {
    assert.equal(mapPublicVenueFromEditionRow({ venue_id: null }), null);
  });

  it("maps venue embed when venue_id is set", () => {
    const venue = mapPublicVenueFromEditionRow({
      venue_id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
      venues: {
        id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
        name: "Marina Bay Sands",
        website_url: "https://example.com",
        address_text: "10 Bayfront Ave",
        logo_url: "https://example.com/logo.png",
        archived_at: "2026-01-01T00:00:00",
      },
    });

    assert.ok(venue);
    assert.equal(venue?.name, "Marina Bay Sands");
    assert.equal(venue?.archived_at, "2026-01-01T00:00:00");
  });
});

describe("editionHasVenueId", () => {
  it("detects venue_id on edition row", () => {
    assert.equal(
      editionHasVenueId({ venue_id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5" }),
      true,
    );
    assert.equal(editionHasVenueId({ venue_id: null }), false);
  });
});
