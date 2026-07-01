import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyVenueLogoUrlForBackfill,
  isOwnedVenueLogoStorageUrl,
} from "./resolveVenueManualLogoUrl";
import {
  selectAllVenueLogoObjectPaths,
  selectStaleVenueLogoCleanupPaths,
  venueLogoObjectPath,
} from "./venueLogoStorage";

const VENUE_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_VENUE_ID = "00000000-0000-4000-8000-000000000002";
const SUPABASE_PUBLIC_BASE =
  "https://example.supabase.co/storage/v1/object/public/company-logos";

describe("isOwnedVenueLogoStorageUrl", () => {
  it("returns true for canonical owned venue storage URLs", () => {
    const url = `${SUPABASE_PUBLIC_BASE}/venues/${VENUE_ID}/logo.png`;
    assert.equal(isOwnedVenueLogoStorageUrl(url, VENUE_ID), true);
  });

  it("returns false for another venue's storage URL", () => {
    const url = `${SUPABASE_PUBLIC_BASE}/venues/${OTHER_VENUE_ID}/logo.png`;
    assert.equal(isOwnedVenueLogoStorageUrl(url, VENUE_ID), false);
  });

  it("returns false for event-series storage URLs", () => {
    const url = `${SUPABASE_PUBLIC_BASE}/event-series/${VENUE_ID}/logo.png`;
    assert.equal(isOwnedVenueLogoStorageUrl(url, VENUE_ID), false);
  });

  it("returns false for external URLs", () => {
    assert.equal(isOwnedVenueLogoStorageUrl("https://cdn.example.com/logo.png", VENUE_ID), false);
  });
});

describe("classifyVenueLogoUrlForBackfill", () => {
  it("skips null and owned storage URLs", () => {
    assert.deepEqual(classifyVenueLogoUrlForBackfill(null, VENUE_ID), {
      action: "skip",
      reason: "no_logo_url",
    });

    const owned = `${SUPABASE_PUBLIC_BASE}/venues/${VENUE_ID}/logo.webp`;
    assert.deepEqual(classifyVenueLogoUrlForBackfill(owned, VENUE_ID), {
      action: "skip",
      reason: "already_owned_storage",
    });
  });

  it("skips foreign company-logos URLs", () => {
    const foreignSeries = `${SUPABASE_PUBLIC_BASE}/event-series/${VENUE_ID}/logo.png`;
    assert.deepEqual(classifyVenueLogoUrlForBackfill(foreignSeries, VENUE_ID), {
      action: "skip",
      reason: "foreign_storage_url",
    });

    const foreignVenue = `${SUPABASE_PUBLIC_BASE}/venues/${OTHER_VENUE_ID}/logo.png`;
    assert.deepEqual(classifyVenueLogoUrlForBackfill(foreignVenue, VENUE_ID), {
      action: "skip",
      reason: "foreign_storage_url",
    });
  });

  it("marks external HTTP URLs for ingest", () => {
    assert.deepEqual(
      classifyVenueLogoUrlForBackfill("https://example.com/venue-logo.png", VENUE_ID),
      { action: "ingest" },
    );
  });
});

describe("logo clear cleanup paths", () => {
  it("selectAllVenueLogoObjectPaths covers every extension under venues/{venueId}/", () => {
    const paths = selectAllVenueLogoObjectPaths(VENUE_ID);
    assert.ok(paths.every((path) => path.startsWith(`venues/${VENUE_ID}/logo.`)));
    assert.equal(paths.length > 0, true);
  });

  it("selectStaleVenueLogoCleanupPaths removes alternate extensions after ingest", () => {
    const activePath = venueLogoObjectPath(VENUE_ID, "png");
    const stalePaths = selectStaleVenueLogoCleanupPaths({
      venueId: VENUE_ID,
      activeStoragePath: activePath,
    });

    assert.ok(stalePaths.includes(venueLogoObjectPath(VENUE_ID, "webp")));
    assert.ok(!stalePaths.includes(activePath));
  });
});
