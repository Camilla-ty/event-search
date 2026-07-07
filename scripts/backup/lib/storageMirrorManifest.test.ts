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
  it("summarizes object counts and bytes", () => {
    const manifest = buildStorageMirrorManifest({
      bucket: "company-logos",
      mirroredAt: "2026-07-07T10:00:00Z",
      objects: [
        { path: "companies/a/logo.png", size: 100, updated_at: null },
        { path: "venues/b/logo.webp", size: 250, updated_at: null },
      ],
      supabaseHost: "example.supabase.co",
      gitSha: "abc123",
    });

    assert.equal(manifest.object_count, 2);
    assert.equal(manifest.total_bytes, 350);
    assert.deepEqual(manifest.top_level_prefixes, ["companies", "venues"]);
    assert.equal(manifest.supabase_host, "example.supabase.co");
    assert.equal(manifest.git_sha, "abc123");
  });
});
