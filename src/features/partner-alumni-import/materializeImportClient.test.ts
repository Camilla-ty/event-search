import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runCompanyMaterialization } from "@/src/features/sponsor-import/materializeCompaniesClient";

import { runVersionMemberMaterialization } from "./materializeImportClient";
import { partnerAlumniMaterializeChunkResponse } from "./server/materializeChunkApiResponse";
import type {
  MaterializeCompaniesChunkResult,
  MaterializeVersionMembersChunkResult,
} from "./types";

function resolvedBatchCompaniesChunk(
  overrides: Partial<MaterializeCompaniesChunkResult> = {},
): MaterializeCompaniesChunkResult {
  return {
    examined_count: 0,
    skipped_count: 454,
    materialized_count: 0,
    companies_created: 0,
    total_resolved_rows: 454,
    rows_with_company_id: 454,
    done: true,
    next_cursor: null,
    ...overrides,
  };
}

function resolvedBatchMembersChunk(
  overrides: Partial<MaterializeVersionMembersChunkResult> = {},
): MaterializeVersionMembersChunkResult {
  return {
    examined_count: 454,
    skipped_count: 0,
    members_created: 454,
    members_updated: 0,
    rows_linked: 454,
    total_resolved_rows: 454,
    rows_with_version_member: 454,
    done: true,
    next_cursor: null,
    ...overrides,
  };
}

describe("partnerAlumniMaterializeChunkResponse", () => {
  it("wraps chunk payloads under result for shared client parsers", () => {
    assert.deepEqual(partnerAlumniMaterializeChunkResponse(resolvedBatchCompaniesChunk()), {
      ok: true,
      result: resolvedBatchCompaniesChunk(),
    });
  });
});

describe("partner alumni materializeImportClient", () => {
  it("fails when chunk API spreads fields at the top level instead of under result", async () => {
    const flatCompaniesChunk = {
      ok: true as const,
      ...resolvedBatchCompaniesChunk(),
    };

    await assert.rejects(
      () =>
        runCompanyMaterialization(async () => flatCompaniesChunk as never, {
          onProgress: () => {},
        }),
      (error: unknown) => {
        assert.ok(error instanceof TypeError);
        assert.match(
          error.message,
          /Cannot read properties of undefined \(reading 'rows_with_company_id'\)/,
        );
        return true;
      },
    );
  });

  it("completes company materialization for 454 resolved rows with 0 create-new", async () => {
    let chunkCalls = 0;

    const outcome = await runCompanyMaterialization(async () => {
      chunkCalls += 1;
      return partnerAlumniMaterializeChunkResponse(resolvedBatchCompaniesChunk());
    });

    assert.deepEqual(outcome, {
      ok: true,
      result: resolvedBatchCompaniesChunk(),
    });
    assert.equal(chunkCalls, 1);
  });

  it("completes member linking for 454 resolved rows with nested chunk results", async () => {
    const progress: string[] = [];
    let chunkCalls = 0;

    const outcome = await runVersionMemberMaterialization(
      { seriesId: "series-1", versionId: "version-1" },
      "batch-1",
      {
        chunkFn: async () => {
          chunkCalls += 1;
          return partnerAlumniMaterializeChunkResponse(resolvedBatchMembersChunk());
        },
        onProgress: ({ rowsWithVersionMember, totalResolvedRows }) => {
          progress.push(`${rowsWithVersionMember}/${totalResolvedRows}`);
        },
      },
    );

    assert.deepEqual(outcome, {
      ok: true,
      result: resolvedBatchMembersChunk(),
    });
    assert.equal(chunkCalls, 1);
    assert.deepEqual(progress, ["454/454"]);
  });
});
