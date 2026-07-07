import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eventSeriesLogoObjectPath,
  parseEventSeriesLogoStoragePathFromUrl,
  selectAllEventSeriesLogoObjectPaths,
  selectStaleEventSeriesLogoCleanupPaths,
} from "./eventSeriesLogoStorage";

const SERIES_ID = "00000000-0000-4000-8000-000000000001";
const SUPABASE_PUBLIC_BASE =
  "https://example.supabase.co/storage/v1/object/public/company-logos";

describe("eventSeriesLogoObjectPath", () => {
  it("generates event-series/{seriesId}/logo.{ext} under company-logos bucket", () => {
    assert.equal(
      eventSeriesLogoObjectPath(SERIES_ID, "png"),
      `event-series/${SERIES_ID}/logo.png`,
    );
    assert.equal(
      eventSeriesLogoObjectPath(SERIES_ID, "webp"),
      `event-series/${SERIES_ID}/logo.webp`,
    );
  });
});

describe("selectStaleEventSeriesLogoCleanupPaths", () => {
  it("lists png as stale when webp is active (png → webp replacement)", () => {
    const activePath = eventSeriesLogoObjectPath(SERIES_ID, "webp");
    const stalePaths = selectStaleEventSeriesLogoCleanupPaths({
      seriesId: SERIES_ID,
      activeStoragePath: activePath,
    });

    assert.ok(stalePaths.includes(eventSeriesLogoObjectPath(SERIES_ID, "png")));
    assert.ok(!stalePaths.includes(activePath));
  });

  it("returns no candidates when active path is outside the series folder", () => {
    const stalePaths = selectStaleEventSeriesLogoCleanupPaths({
      seriesId: SERIES_ID,
      activeStoragePath: "event-series/other-series/logo.webp",
    });

    assert.deepEqual(stalePaths, []);
  });
});

describe("selectAllEventSeriesLogoObjectPaths", () => {
  it("includes every known extension for logo clear cleanup", () => {
    const paths = selectAllEventSeriesLogoObjectPaths(SERIES_ID);
    assert.ok(paths.includes(eventSeriesLogoObjectPath(SERIES_ID, "png")));
    assert.ok(paths.includes(eventSeriesLogoObjectPath(SERIES_ID, "webp")));
  });
});

describe("parseEventSeriesLogoStoragePathFromUrl", () => {
  it("parses canonical event-series storage URLs", () => {
    const publicUrl = `${SUPABASE_PUBLIC_BASE}/event-series/${SERIES_ID}/logo.webp`;
    const parsed = parseEventSeriesLogoStoragePathFromUrl(publicUrl);

    assert.ok(parsed);
    assert.equal(parsed.seriesId, SERIES_ID);
    assert.equal(parsed.extension, "webp");
    assert.equal(parsed.bucketRelativePath, `event-series/${SERIES_ID}/logo.webp`);
  });

  it("parses bucket-relative event-series logo paths", () => {
    const parsed = parseEventSeriesLogoStoragePathFromUrl(
      `event-series/${SERIES_ID}/logo.jpg`,
    );

    assert.ok(parsed);
    assert.equal(parsed.seriesId, SERIES_ID);
    assert.equal(parsed.extension, "jpg");
    assert.equal(parsed.bucketRelativePath, `event-series/${SERIES_ID}/logo.jpg`);
  });

  it("rejects company logo paths", () => {
    const publicUrl = `${SUPABASE_PUBLIC_BASE}/companies/${SERIES_ID}/logo.png`;
    assert.equal(parseEventSeriesLogoStoragePathFromUrl(publicUrl), null);
  });
});

describe("verifyEventSeriesLogoStorageObject", () => {
  it("is exported for pre-DB verification of uploaded objects", async () => {
    const module = await import("./eventSeriesLogoStorage");
    assert.equal(typeof module.verifyEventSeriesLogoStorageObject, "function");
  });
});
