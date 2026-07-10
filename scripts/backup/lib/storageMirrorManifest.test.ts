import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStorageMirrorManifest,
  topLevelPrefixes,
} from "./storageMirrorManifest";

describe("topLevelPrefixes", () => {
  it("collects unique first path segments", () => {
    assert.deepEqual(
      topLevelPrefixes([
        "companies/a/logo.png",
        "companies/b/logo.jpg",
        "event-series/c/logo.svg",
        "venues/d/logo.webp",
        "legacy-root.png",
      ]),
      ["companies", "event-series", "legacy-root.png", "venues"],
    );
  });
});

describe("buildStorageMirrorManifest", () => {
  it("records db-referenced backup metadata", () => {
    const manifest = buildStorageMirrorManifest({
      bucket: "company-logos",
      mirroredAt: "2026-07-07T10:00:00Z",
      referencedPathCount: 3,
      downloadedObjects: [
        { path: "companies/a/logo.png", size: 100, updated_at: null },
        { path: "venues/b/logo.webp", size: 250, updated_at: null },
      ],
      missingPaths: ["event-series/c/logo.svg"],
      skippedExternalUrlCount: 2,
      skippedInvalidCount: 1,
      supabaseHost: "example.supabase.co",
      gitSha: "abc123",
    });

    assert.equal(manifest.version, 2);
    assert.equal(manifest.source, "db_referenced_paths");
    assert.equal(manifest.referenced_path_count, 3);
    assert.equal(manifest.downloaded_count, 2);
    assert.equal(manifest.object_count, 2);
    assert.equal(manifest.total_bytes, 350);
    assert.deepEqual(manifest.missing_paths, ["event-series/c/logo.svg"]);
    assert.equal(manifest.skipped_external_url_count, 2);
    assert.equal(manifest.skipped_invalid_count, 1);
    assert.deepEqual(manifest.top_level_prefixes, ["companies", "venues"]);
    assert.equal(manifest.supabase_host, "example.supabase.co");
    assert.equal(manifest.git_sha, "abc123");
  });
});
