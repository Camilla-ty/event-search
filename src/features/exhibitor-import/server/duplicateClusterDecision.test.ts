import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeRows, type ImportRowRecord } from "./batchGuards";
import {
  buildDuplicateClusterKeepPatches,
  type DuplicateClusterDecisionRow,
} from "./exhibitorImportAdmin";

const NOW = "2026-06-25T07:00:00.000Z";
const ACTOR_ID = "00000000-0000-4000-8000-000000000001";

function clusterRows(): DuplicateClusterDecisionRow[] {
  return [
    { id: "row-1", duplicate_cluster_key: "google.com" },
    { id: "row-2", duplicate_cluster_key: "google.com" },
    { id: "row-3", duplicate_cluster_key: "google.com" },
  ];
}

function summaryRows(
  patches: ReturnType<typeof buildDuplicateClusterKeepPatches>,
): ImportRowRecord[] {
  const byId = new Map(patches.map((item) => [item.id, item.patch]));
  return [
    {
      id: "row-1",
      status: (byId.get("row-1")?.status as ImportRowRecord["status"]) ?? "resolved",
      has_blocking_validation: false,
      duplicate_role: "canonical",
      duplicate_resolution: (byId.get("row-1")?.duplicate_resolution as string | null) ?? null,
    },
    {
      id: "row-2",
      status: (byId.get("row-2")?.status as ImportRowRecord["status"]) ?? "needs_review",
      has_blocking_validation: false,
      duplicate_role: "duplicate",
      duplicate_resolution:
        (byId.get("row-2")?.duplicate_resolution as string | null) ?? "pending",
    },
    {
      id: "row-3",
      status: (byId.get("row-3")?.status as ImportRowRecord["status"]) ?? "needs_review",
      has_blocking_validation: false,
      duplicate_role: "duplicate",
      duplicate_resolution:
        (byId.get("row-3")?.duplicate_resolution as string | null) ?? "pending",
    },
  ];
}

describe("buildDuplicateClusterKeepPatches", () => {
  it("keeps the canonical row and excludes sibling duplicates", () => {
    const patches = buildDuplicateClusterKeepPatches({
      clusterRows: clusterRows(),
      selectedRowId: "row-1",
      selectedPatch: {
        status: "resolved",
        decision_type: "use_matched",
        resolved_company_id: "company-1",
        decision_source: "admin_manual",
        decision_by: ACTOR_ID,
        decision_at: NOW,
        updated_at: NOW,
      },
      actorId: ACTOR_ID,
      now: NOW,
    });

    assert.equal(patches.find((item) => item.id === "row-1")?.patch.duplicate_resolution, "kept");
    assert.equal(patches.find((item) => item.id === "row-2")?.patch.status, "excluded");
    assert.equal(patches.find((item) => item.id === "row-3")?.patch.status, "excluded");
    assert.equal(summarizeRows(summaryRows(patches)).pending_duplicate_count, 0);
  });

  it("keeps a non-canonical duplicate row and excludes all siblings", () => {
    const patches = buildDuplicateClusterKeepPatches({
      clusterRows: clusterRows(),
      selectedRowId: "row-2",
      selectedPatch: {
        status: "resolved",
        decision_type: "create_new",
        resolved_company_id: null,
        decision_source: "admin_manual",
        decision_by: ACTOR_ID,
        decision_at: NOW,
        updated_at: NOW,
      },
      actorId: ACTOR_ID,
      now: NOW,
    });

    assert.equal(patches.find((item) => item.id === "row-2")?.patch.duplicate_resolution, "kept");
    assert.equal(patches.find((item) => item.id === "row-1")?.patch.status, "excluded");
    assert.equal(patches.find((item) => item.id === "row-3")?.patch.status, "excluded");
    assert.equal(summarizeRows(summaryRows(patches)).pending_duplicate_count, 0);
  });

  it("writes audit fields when excluding sibling rows", () => {
    const patches = buildDuplicateClusterKeepPatches({
      clusterRows: clusterRows(),
      selectedRowId: "row-3",
      selectedPatch: {
        status: "resolved",
        decision_type: "create_new",
        resolved_company_id: null,
        decision_source: "admin_manual",
        decision_by: ACTOR_ID,
        decision_at: NOW,
        updated_at: NOW,
      },
      actorId: ACTOR_ID,
      now: NOW,
    });
    const sibling = patches.find((item) => item.id === "row-1")?.patch;

    assert.equal(sibling?.decision_type, "exclude");
    assert.equal(sibling?.decision_source, "admin_manual");
    assert.equal(sibling?.decision_by, ACTOR_ID);
    assert.equal(sibling?.decision_at, NOW);
    assert.equal(sibling?.updated_at, NOW);
    assert.equal(sibling?.duplicate_resolution, "excluded");
    assert.equal(sibling?.resolved_company_id, null);
  });
});
