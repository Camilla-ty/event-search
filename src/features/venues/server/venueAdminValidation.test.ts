import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  duplicateVenueNameWarning,
  isUuid,
  parseCreateVenueFields,
  parseUpdateVenueFields,
} from "./venueAdminValidation";

describe("isUuid", () => {
  it("accepts lowercase uuid", () => {
    assert.equal(isUuid("7ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5"), true);
  });

  it("rejects empty string", () => {
    assert.equal(isUuid(""), false);
  });
});

describe("parseCreateVenueFields", () => {
  it("requires name, slug, and city_id", () => {
    const { errors } = parseCreateVenueFields({});
    assert.ok(errors.includes("name is required"));
    assert.ok(errors.includes("slug is required"));
    assert.ok(errors.includes("city_id is required"));
  });

  it("validates optional URLs", () => {
    const { errors } = parseCreateVenueFields({
      name: "Marina Bay Sands",
      slug: "marina-bay-sands",
      city_id: "7ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
      website_url: "http://",
      logo_url: "not a url",
    });
    assert.ok(errors.includes("website_url must be a valid URL"));
    assert.ok(errors.includes("logo_url must be a valid URL"));
  });

  it("accepts valid optional fields", () => {
    const { errors, fields } = parseCreateVenueFields({
      name: "Marina Bay Sands",
      slug: "marina-bay-sands",
      city_id: "7ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
      website_url: "https://example.com",
      address_text: "  10 Bayfront Ave  ",
      logo_url: null,
    });
    assert.equal(errors.length, 0);
    assert.equal(fields.address_text, "10 Bayfront Ave");
    assert.equal(fields.website_url, "https://example.com");
    assert.equal(fields.logo_url, null);
  });
});

describe("parseUpdateVenueFields", () => {
  it("rejects direct archived_at updates", () => {
    const { errors } = parseUpdateVenueFields({ archived_at: "2026-01-01T00:00:00Z" });
    assert.ok(errors.some((error) => error.includes("archive or unarchive")));
  });

  it("rejects empty name", () => {
    const { errors } = parseUpdateVenueFields({ name: "   " });
    assert.ok(errors.includes("name cannot be empty"));
  });

  it("validates city_id uuid", () => {
    const { errors } = parseUpdateVenueFields({ city_id: "bad-id" });
    assert.ok(errors.includes("city_id must be a valid UUID"));
  });
});

describe("duplicateVenueNameWarning", () => {
  it("returns null when no duplicates", () => {
    assert.equal(duplicateVenueNameWarning("Venue A", ["Venue B"]), null);
  });

  it("returns warning for case-insensitive duplicate", () => {
    const warning = duplicateVenueNameWarning("venue a", ["Venue A"]);
    assert.ok(warning?.includes("venue a"));
    assert.ok(warning?.includes("already exists"));
  });
});
