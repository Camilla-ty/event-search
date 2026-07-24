import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTO_READY_MATCH_METHODS,
  matchesAutoReadyBulkAcceptCriteria,
} from "./matchRows";
import {
  bulkAcceptDomainMatchesWithDeps,
  type BulkAcceptDomainMatchPatch,
} from "./exhibitorImportAdmin";

const BATCH_ID = "batch-1";
const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
const COMPANY_ID = "00000000-0000-4000-8000-0000000000aa";

describe("AUTO_READY_MATCH_METHODS", () => {
  it("includes domain, alias, and website auto-ready match methods", () => {
    assert.deepEqual([...AUTO_READY_MATCH_METHODS], ["domain", "alias", "website"]);
  });
});

describe("matchesAutoReadyBulkAcceptCriteria", () => {
  it("matches domain auto_ready rows", () => {
    assert.equal(
      matchesAutoReadyBulkAcceptCriteria({
        status: "auto_ready",
        match_confidence: "high",
        match_method: "domain",
      }),
      true,
    );
  });

  it("matches alias auto_ready rows", () => {
    assert.equal(
      matchesAutoReadyBulkAcceptCriteria({
        status: "auto_ready",
        match_confidence: "high",
        match_method: "alias",
      }),
      true,
    );
  });

  it("rejects exact_name rows even when auto_ready", () => {
    assert.equal(
      matchesAutoReadyBulkAcceptCriteria({
        status: "auto_ready",
        match_confidence: "high",
        match_method: "exact_name",
      }),
      false,
    );
  });

  it("rejects resolved rows", () => {
    assert.equal(
      matchesAutoReadyBulkAcceptCriteria({
        status: "resolved",
        match_confidence: "high",
        match_method: "domain",
      }),
      false,
    );
  });
});

describe("bulkAcceptDomainMatchesWithDeps", () => {
  function createDeps(
    rows: Array<{
      id: string;
      match_method: "domain" | "alias";
      proposed_company_id: string | null;
    }>,
  ) {
    const patches = new Map<string, BulkAcceptDomainMatchPatch>();
    let loggedCount: number | null = null;

    return {
      patches,
      loggedCount: () => loggedCount,
      deps: {
        fetchAutoReadyRows: async () =>
          rows
            .filter((row) =>
              matchesAutoReadyBulkAcceptCriteria({
                status: "auto_ready",
                match_confidence: "high",
                match_method: row.match_method,
              }),
            )
            .map((row) => ({
              id: row.id,
              proposed_company_id: row.proposed_company_id,
            })),
        resolveRow: async (rowId: string, patch: BulkAcceptDomainMatchPatch) => {
          patches.set(rowId, patch);
        },
        logAction: async ({ affectedCount }: { affectedCount: number }) => {
          loggedCount = affectedCount;
        },
      },
    };
  }

  it("resolves domain auto_ready rows", async () => {
    const { deps, patches, loggedCount } = createDeps([
      { id: "row-domain", match_method: "domain", proposed_company_id: COMPANY_ID },
    ]);

    const result = await bulkAcceptDomainMatchesWithDeps(BATCH_ID, ACTOR_ID, deps);

    assert.equal(result.accepted_count, 1);
    assert.equal(loggedCount(), 1);
    const patch = patches.get("row-domain");
    assert.equal(patch?.status, "resolved");
    assert.equal(patch?.decision_type, "use_matched");
    assert.equal(patch?.resolved_company_id, COMPANY_ID);
    assert.equal(patch?.decision_by, ACTOR_ID);
  });

  it("resolves alias auto_ready rows", async () => {
    const { deps, patches, loggedCount } = createDeps([
      { id: "row-alias", match_method: "alias", proposed_company_id: COMPANY_ID },
    ]);

    const result = await bulkAcceptDomainMatchesWithDeps(BATCH_ID, ACTOR_ID, deps);

    assert.equal(result.accepted_count, 1);
    assert.equal(loggedCount(), 1);
    const patch = patches.get("row-alias");
    assert.equal(patch?.status, "resolved");
    assert.equal(patch?.decision_type, "use_matched");
    assert.equal(patch?.resolved_company_id, COMPANY_ID);
  });

  it("resolves both domain and alias auto_ready rows in one pass", async () => {
    const { deps, patches } = createDeps([
      { id: "row-domain", match_method: "domain", proposed_company_id: COMPANY_ID },
      {
        id: "row-alias",
        match_method: "alias",
        proposed_company_id: "00000000-0000-4000-8000-0000000000bb",
      },
    ]);

    const result = await bulkAcceptDomainMatchesWithDeps(BATCH_ID, ACTOR_ID, deps);

    assert.equal(result.accepted_count, 2);
    assert.equal(patches.size, 2);
    assert.equal(patches.get("row-domain")?.status, "resolved");
    assert.equal(patches.get("row-alias")?.status, "resolved");
  });

  it("skips rows without proposed_company_id", async () => {
    const { deps, patches } = createDeps([
      { id: "row-missing-proposal", match_method: "alias", proposed_company_id: null },
    ]);

    const result = await bulkAcceptDomainMatchesWithDeps(BATCH_ID, ACTOR_ID, deps);

    assert.equal(result.accepted_count, 0);
    assert.equal(patches.size, 0);
  });

  it("does not resolve rows excluded from fetch results", async () => {
    const { deps, patches } = createDeps([]);

    const result = await bulkAcceptDomainMatchesWithDeps(BATCH_ID, ACTOR_ID, deps);

    assert.equal(result.accepted_count, 0);
    assert.equal(patches.size, 0);
  });
});
