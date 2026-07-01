import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateEditionVenueAttachment,
  validateEditionVenueFieldsSync,
} from "./editionVenue";

const CITY_ID = "7ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5";
const VENUE_ID = "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5";
const OTHER_VENUE_ID = "9ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5";

describe("validateEditionVenueFieldsSync", () => {
  it("requires city when venue is set", () => {
    const errors = validateEditionVenueFieldsSync({
      venueId: VENUE_ID,
      cityId: null,
    });
    assert.ok(errors.includes("city_id is required when venue_id is set"));
  });

  it("allows null venue", () => {
    assert.deepEqual(
      validateEditionVenueFieldsSync({ venueId: null, cityId: null }),
      [],
    );
  });
});

describe("validateEditionVenueAttachment", () => {
  it("is exported as an async validator", () => {
    assert.equal(typeof validateEditionVenueAttachment, "function");
  });

  it("accepts retaining the same archived venue id without DB", async () => {
    const errors = await validateEditionVenueAttachment({
      venueId: null,
      cityId: CITY_ID,
      previousVenueId: VENUE_ID,
    });
    assert.deepEqual(errors, []);
  });
});
