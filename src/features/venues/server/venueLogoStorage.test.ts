import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseVenueLogoStoragePathFromUrl,
  selectAllVenueLogoObjectPaths,
  selectStaleVenueLogoCleanupPaths,
  venueLogoObjectPath,
} from "./venueLogoStorage";

const VENUE_ID = "00000000-0000-4000-8000-000000000001";
const SUPABASE_PUBLIC_BASE =
  "https://example.supabase.co/storage/v1/object/public/company-logos";

describe("venueLogoObjectPath", () => {
  it("generates venues/{venueId}/logo.{ext} under company-logos bucket", () => {
    assert.equal(venueLogoObjectPath(VENUE_ID, "png"), `venues/${VENUE_ID}/logo.png`);
    assert.equal(venueLogoObjectPath(VENUE_ID, "webp"), `venues/${VENUE_ID}/logo.webp`);
  });
});

describe("selectStaleVenueLogoCleanupPaths", () => {
  it("lists png as stale when webp is active", () => {
    const activePath = venueLogoObjectPath(VENUE_ID, "webp");
    const stalePaths = selectStaleVenueLogoCleanupPaths({
      venueId: VENUE_ID,
      activeStoragePath: activePath,
    });

    assert.ok(stalePaths.includes(venueLogoObjectPath(VENUE_ID, "png")));
    assert.ok(!stalePaths.includes(activePath));
  });
});

describe("selectAllVenueLogoObjectPaths", () => {
  it("includes every known extension for logo clear cleanup", () => {
    const paths = selectAllVenueLogoObjectPaths(VENUE_ID);
    assert.ok(paths.includes(venueLogoObjectPath(VENUE_ID, "png")));
    assert.ok(paths.includes(venueLogoObjectPath(VENUE_ID, "webp")));
  });
});

describe("parseVenueLogoStoragePathFromUrl", () => {
  it("parses canonical venue storage URLs", () => {
    const publicUrl = `${SUPABASE_PUBLIC_BASE}/venues/${VENUE_ID}/logo.webp`;
    const parsed = parseVenueLogoStoragePathFromUrl(publicUrl);

    assert.ok(parsed);
    assert.equal(parsed.venueId, VENUE_ID);
    assert.equal(parsed.extension, "webp");
    assert.equal(parsed.bucketRelativePath, `venues/${VENUE_ID}/logo.webp`);
  });

  it("rejects event-series logo paths", () => {
    const publicUrl = `${SUPABASE_PUBLIC_BASE}/event-series/${VENUE_ID}/logo.png`;
    assert.equal(parseVenueLogoStoragePathFromUrl(publicUrl), null);
  });
});

describe("verifyVenueLogoStorageObject", () => {
  it("is exported for pre-DB verification of uploaded objects", async () => {
    const module = await import("./venueLogoStorage");
    assert.equal(typeof module.verifyVenueLogoStorageObject, "function");
  });
});
