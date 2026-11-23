import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  MATERIALIZE_CHUNK_TIMEOUT_MS,
  MATERIALIZE_COMPANIES_FAILED_MESSAGE,
  materializeCompaniesProgressLabel,
  runCompanyMaterialization,
  type MaterializeChunkResponse,
} from "./materializeCompaniesClient";
import type { MaterializeCompaniesChunkResult } from "./types";

describe("chunk timeout vs route maxDuration", () => {
  for (const route of ["materialize-companies/chunk", "materialize-draft-links/chunk"]) {
    it(`outlasts the ${route} route, so a retry never overlaps a running chunk`, () => {
      const source = readFileSync(
        join(process.cwd(), "src/app/api/admin/sponsor-imports/batches/[batchId]", route, "route.ts"),
        "utf8",
      );
      const maxDuration = Number(/export const maxDuration = (\d+);/.exec(source)?.[1]);
      assert.ok(maxDuration > 0, `expected a numeric maxDuration in ${route}`);
      assert.ok(
        MATERIALIZE_CHUNK_TIMEOUT_MS > maxDuration * 1000,
        `client timeout ${MATERIALIZE_CHUNK_TIMEOUT_MS}ms must exceed ${maxDuration}s`,
      );
    });
  }
});

function chunk(
  overrides: Partial<MaterializeCompaniesChunkResult>,
): MaterializeChunkResponse {
  return {
    ok: true,
    result: {
      examined_count: 0,
      skipped_count: 0,
      materialized_count: 0,
      companies_created: 0,
      total_resolved_rows: 0,
      rows_with_company_id: 0,
      done: true,
      next_cursor: null,
      ...overrides,
    },
  };
}

describe("materializeCompaniesProgressLabel", () => {
  it("shows a counted label when totals are known", () => {
    assert.equal(
      materializeCompaniesProgressLabel({ rowsWithCompanyId: 30, totalResolvedRows: 120 }),
      "Creating companies… 30/120",
    );
  });

  it("falls back to a generic label when there are no resolved rows yet", () => {
    assert.equal(
      materializeCompaniesProgressLabel({ rowsWithCompanyId: 0, totalResolvedRows: 0 }),
      "Creating companies…",
    );
  });
});

describe("runCompanyMaterialization", () => {
  it("completes in a single chunk when the server reports done", async () => {
    const calls: Array<number | undefined> = [];
    const result = await runCompanyMaterialization((cursor) => {
      calls.push(cursor);
      return Promise.resolve(
        chunk({ examined_count: 5, total_resolved_rows: 5, rows_with_company_id: 5, done: true }),
      );
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls, [undefined]);
  });

  it("sends no claim token first, then the token returned by the previous chunk", async () => {
    const tokens: Array<string | undefined> = [];
    const responses: MaterializeChunkResponse[] = [
      chunk({ examined_count: 50, total_resolved_rows: 120, rows_with_company_id: 50, done: false, next_cursor: 50, claim_token: "token-1" }),
      chunk({ examined_count: 50, total_resolved_rows: 120, rows_with_company_id: 100, done: false, next_cursor: 100, claim_token: "token-2" }),
      chunk({ examined_count: 20, total_resolved_rows: 120, rows_with_company_id: 120, done: true, claim_token: null }),
    ];

    let index = 0;
    const result = await runCompanyMaterialization((_cursor, claimToken) => {
      tokens.push(claimToken);
      return Promise.resolve(responses[index++]);
    });

    assert.equal(result.ok, true);
    assert.deepEqual(tokens, [undefined, "token-1", "token-2"]);
  });

  it("resumes across chunks by forwarding next_cursor", async () => {
    const calls: Array<number | undefined> = [];
    const responses: MaterializeChunkResponse[] = [
      chunk({
        examined_count: 50,
        materialized_count: 50,
        total_resolved_rows: 120,
        rows_with_company_id: 50,
        done: false,
        next_cursor: 50,
      }),
      chunk({
        examined_count: 50,
        materialized_count: 50,
        total_resolved_rows: 120,
        rows_with_company_id: 100,
        done: false,
        next_cursor: 100,
      }),
      chunk({
        examined_count: 20,
        materialized_count: 20,
        total_resolved_rows: 120,
        rows_with_company_id: 120,
        done: true,
        next_cursor: null,
      }),
    ];

    let index = 0;
    const result = await runCompanyMaterialization((cursor) => {
      calls.push(cursor);
      return Promise.resolve(responses[index++]);
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls, [undefined, 50, 100]);
  });

  it("reports progress for each chunk", async () => {
    const progress: Array<{ rowsWithCompanyId: number; totalResolvedRows: number }> = [];
    const responses: MaterializeChunkResponse[] = [
      chunk({
        examined_count: 1,
        total_resolved_rows: 2,
        rows_with_company_id: 1,
        done: false,
        next_cursor: 1,
      }),
      chunk({
        examined_count: 1,
        total_resolved_rows: 2,
        rows_with_company_id: 2,
        done: true,
        next_cursor: null,
      }),
    ];
    let index = 0;
    await runCompanyMaterialization(() => Promise.resolve(responses[index++]), {
      onProgress: (p) => progress.push(p),
    });

    assert.deepEqual(progress, [
      { rowsWithCompanyId: 1, totalResolvedRows: 2 },
      { rowsWithCompanyId: 2, totalResolvedRows: 2 },
    ]);
  });

  it("returns the server error and stops looping on chunk failure", async () => {
    let callCount = 0;
    const result = await runCompanyMaterialization(() => {
      callCount += 1;
      return Promise.resolve({ ok: false, error: "boom" });
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "boom");
    }
    assert.equal(callCount, 1);
  });

  it("stops defensively when a non-done chunk makes no progress", async () => {
    let callCount = 0;
    const result = await runCompanyMaterialization(() => {
      callCount += 1;
      return Promise.resolve(
        chunk({ examined_count: 0, total_resolved_rows: 5, rows_with_company_id: 1, done: false }),
      );
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, MATERIALIZE_COMPANIES_FAILED_MESSAGE);
    }
    assert.equal(callCount, 1);
  });

  it("stops after the iteration cap to avoid spinning forever", async () => {
    let callCount = 0;
    const result = await runCompanyMaterialization(
      () => {
        callCount += 1;
        return Promise.resolve(
          chunk({
            examined_count: 1,
            total_resolved_rows: 999,
            rows_with_company_id: callCount,
            done: false,
            next_cursor: callCount,
          }),
        );
      },
      { maxIterations: 3 },
    );

    assert.equal(result.ok, false);
    assert.equal(callCount, 3);
  });
});
