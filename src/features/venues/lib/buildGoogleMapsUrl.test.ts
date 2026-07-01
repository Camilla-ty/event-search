import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVenueGoogleMapsUrl } from "./buildGoogleMapsUrl";

describe("buildVenueGoogleMapsUrl", () => {
  it("returns null when name is empty", () => {
    assert.equal(buildVenueGoogleMapsUrl({ name: "  " }), null);
  });

  it("builds a search URL from venue fields", () => {
    const url = buildVenueGoogleMapsUrl({
      name: "Marina Bay Sands",
      addressText: "10 Bayfront Ave",
      cityLabel: "Singapore, Singapore",
    });
    assert.ok(url?.startsWith("https://www.google.com/maps/search/?api=1&query="));
    assert.ok(url?.includes(encodeURIComponent("10 Bayfront Ave")));
    assert.ok(url?.includes(encodeURIComponent("Marina Bay Sands")));
  });
});
