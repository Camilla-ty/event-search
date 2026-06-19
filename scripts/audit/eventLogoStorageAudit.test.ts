import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEventLogoCleanupPlan,
  buildEventLogoLiveCleanupObjectRecords,
  buildSeriesByIdMap,
  classifyEventLogoStorageObject,
  isEventLogoLiveCleanupDeleteTarget,
  parseEventLogoBucketPath,
  selectEventLogoLiveCleanupDeletePaths,
  summarizeEventLogoAudit,
  summarizeEventLogoLiveCleanup,
} from "./eventLogoStorageAudit";

const SERIES_ID = "00000000-0000-4000-8000-000000000001";
const BUCKET = "company-logos";
const SUPABASE_PUBLIC_BASE =
  "https://example.supabase.co/storage/v1/object/public/company-logos";

describe("parseEventLogoBucketPath", () => {
  it("parses canonical event-series paths", () => {
    const parsed = parseEventLogoBucketPath(`event-series/${SERIES_ID}/logo.webp`);
    assert.ok(parsed);
    assert.equal(parsed.namespace, "event-series");
    assert.equal(parsed.identitySegment, SERIES_ID);
    assert.equal(parsed.extension, "webp");
  });

  it("parses legacy domain-based event-series paths", () => {
    const parsed = parseEventLogoBucketPath("event-series/example.com/logo.png");
    assert.ok(parsed);
    assert.equal(parsed.identitySegment, "example.com");
  });

  it("parses event-editions logo paths", () => {
    const parsed = parseEventLogoBucketPath(
      "event-editions/00000000-0000-4000-8000-000000000002/logo.png",
    );
    assert.ok(parsed);
    assert.equal(parsed.namespace, "event-editions");
  });
});

describe("classifyEventLogoStorageObject", () => {
  const seriesById = buildSeriesByIdMap([
    {
      id: SERIES_ID,
      logo_url: `${SUPABASE_PUBLIC_BASE}/event-series/${SERIES_ID}/logo.webp`,
    },
  ]);

  it("classifies active series logo objects", () => {
    const result = classifyEventLogoStorageObject({
      bucket: BUCKET,
      path: `event-series/${SERIES_ID}/logo.webp`,
      seriesById,
    });

    assert.equal(result.classification, "active_event_series");
    assert.equal(result.referenced_by_logo_url, true);
  });

  it("classifies legacy domain-based event-series objects", () => {
    const result = classifyEventLogoStorageObject({
      bucket: BUCKET,
      path: "event-series/example.com/logo.png",
      seriesById,
    });

    assert.equal(result.classification, "legacy_event_series");
  });

  it("classifies orphan event-editions objects", () => {
    const result = classifyEventLogoStorageObject({
      bucket: BUCKET,
      path: "event-editions/some-edition/logo.png",
      seriesById,
    });

    assert.equal(result.classification, "orphan_event_editions");
  });

  it("classifies unreferenced canonical series paths as unknown cleanup candidates", () => {
    const result = classifyEventLogoStorageObject({
      bucket: BUCKET,
      path: `event-series/${SERIES_ID}/logo.png`,
      seriesById,
    });

    assert.equal(result.classification, "unknown");
    assert.equal(result.reason, "unreferenced_canonical_series_path");
  });
});

describe("summarizeEventLogoAudit", () => {
  it("reports totals by classification", () => {
    const seriesById = buildSeriesByIdMap([
      {
        id: SERIES_ID,
        logo_url: `${SUPABASE_PUBLIC_BASE}/event-series/${SERIES_ID}/logo.webp`,
      },
    ]);

    const objects = [
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: `event-series/${SERIES_ID}/logo.webp`,
        seriesById,
      }),
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: "event-series/example.com/logo.png",
        seriesById,
      }),
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: "event-editions/old-edition/logo.png",
        seriesById,
      }),
    ];

    const summary = summarizeEventLogoAudit({ bucket: BUCKET, objects });
    assert.equal(summary.total_event_series_objects, 2);
    assert.equal(summary.active_event_series_objects, 1);
    assert.equal(summary.legacy_event_series_objects, 1);
    assert.equal(summary.total_event_editions_objects, 1);
    assert.equal(summary.orphan_event_editions_objects, 1);
  });
});

describe("buildEventLogoCleanupPlan", () => {
  it("suggests keeping active series logos and deleting legacy/orphan paths", () => {
    const seriesById = buildSeriesByIdMap([
      {
        id: SERIES_ID,
        logo_url: `${SUPABASE_PUBLIC_BASE}/event-series/${SERIES_ID}/logo.webp`,
      },
    ]);

    const objects = [
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: `event-series/${SERIES_ID}/logo.webp`,
        seriesById,
      }),
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: `event-series/${SERIES_ID}/logo.png`,
        seriesById,
      }),
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: "event-series/example.com/logo.png",
        seriesById,
      }),
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: "event-editions/old-edition/logo.png",
        seriesById,
      }),
    ];

    const plan = buildEventLogoCleanupPlan(objects);
    assert.deepEqual(plan.keep_paths, [`event-series/${SERIES_ID}/logo.webp`]);
    assert.ok(
      plan.delete_candidate_paths.includes("event-series/example.com/logo.png"),
    );
    assert.ok(
      plan.delete_candidate_paths.includes("event-editions/old-edition/logo.png"),
    );
    assert.ok(
      plan.delete_candidate_paths.includes(`event-series/${SERIES_ID}/logo.png`),
    );
    assert.equal(plan.dry_run, true);
  });
});

describe("isEventLogoLiveCleanupDeleteTarget", () => {
  const seriesById = buildSeriesByIdMap([
    {
      id: SERIES_ID,
      logo_url: `${SUPABASE_PUBLIC_BASE}/event-series/${SERIES_ID}/logo.webp`,
    },
  ]);

  it("selects legacy event-series and orphan event-editions for live cleanup", () => {
    const objects = [
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: `event-series/${SERIES_ID}/logo.webp`,
        seriesById,
      }),
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: "event-series/example.com/logo.png",
        seriesById,
      }),
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: "event-editions/old-edition/logo.png",
        seriesById,
      }),
      classifyEventLogoStorageObject({
        bucket: BUCKET,
        path: `event-series/${SERIES_ID}/logo.png`,
        seriesById,
      }),
    ];

    const deletePaths = selectEventLogoLiveCleanupDeletePaths(objects);
    assert.deepEqual(deletePaths, [
      "event-series/example.com/logo.png",
      "event-editions/old-edition/logo.png",
    ]);
  });

  it("never selects active or unknown objects", () => {
    const active = classifyEventLogoStorageObject({
      bucket: BUCKET,
      path: `event-series/${SERIES_ID}/logo.webp`,
      seriesById,
    });
    const unknown = classifyEventLogoStorageObject({
      bucket: BUCKET,
      path: `event-series/${SERIES_ID}/logo.png`,
      seriesById,
    });

    assert.equal(isEventLogoLiveCleanupDeleteTarget(active), false);
    assert.equal(isEventLogoLiveCleanupDeleteTarget(unknown), false);
  });
});

describe("summarizeEventLogoLiveCleanup", () => {
  it("reports inspected, deleted, skipped, failed, and dryRun", () => {
    const records = buildEventLogoLiveCleanupObjectRecords({
      objects: [
        {
          bucket: BUCKET,
          path: "event-series/example.com/logo.png",
          namespace: "event-series",
          classification: "legacy_event_series",
          reason: "domain_based_identity_segment",
          identity_segment: "example.com",
          extension: "png",
          series_id: null,
          referenced_by_logo_url: false,
        },
        {
          bucket: BUCKET,
          path: `event-series/${SERIES_ID}/logo.webp`,
          namespace: "event-series",
          classification: "active_event_series",
          reason: "referenced_by_event_series_logo_url",
          identity_segment: SERIES_ID,
          extension: "webp",
          series_id: SERIES_ID,
          referenced_by_logo_url: true,
        },
      ],
      deletedPaths: new Set<string>(),
      failedPaths: new Map<string, string>(),
      dryRun: true,
    });

    const summary = summarizeEventLogoLiveCleanup({ records, dryRun: true });
    assert.equal(summary.inspected, 2);
    assert.equal(summary.deleted, 1);
    assert.equal(summary.skipped, 1);
    assert.equal(summary.failed, 0);
    assert.equal(summary.dryRun, true);
  });
});
