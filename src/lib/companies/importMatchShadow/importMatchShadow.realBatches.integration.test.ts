import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Read-only shadow against real import batches using createSupabaseImportMatchCandidateSource.
 * Skips cleanly when admin env is missing or DB is unreachable.
 * Never writes / publishes. Assert failures (parity mismatches) are not swallowed.
 */
describe("ARC-003 Phase 2.5 real-batch shadow (Supabase candidate source)", () => {
  it("compares full-directory vs Supabase candidate loader on every available batch", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    if (!url || !key) {
      // Local/CI without secrets — fixture shadow coverage remains authoritative.
      return;
    }

    const { createAdminClient } = await import("@/src/lib/supabase/admin");
    const { runRealBatchImportMatchShadow } = await import(
      "@/src/lib/companies/importMatchShadow/runRealBatchShadow"
    );

    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      return;
    }

    let report;
    try {
      report = await runRealBatchImportMatchShadow(supabase, {
        maxBatchesPerImporter: null,
        maxRowsPerBatch: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Network / auth unreachable — skip. Parity assert failures must still fail the test.
      if (
        message.includes("fetch failed") ||
        message.includes("ENOTFOUND") ||
        message.includes("ECONNREFUSED") ||
        message.includes("Unauthorized")
      ) {
        console.log(`ARC-003 real-batch shadow skipped: ${message}`);
        return;
      }
      throw error;
    }

    assert.equal(report.candidate_source, "supabase");
    assert.ok(
      report.results.length > 0 || report.skipped.length > 0,
      "expected shadow results or skip reasons",
    );

    for (const result of report.results) {
      assert.equal(
        result.summary.compared,
        result.summary.matched,
        `${result.summary.importer}/${result.summary.batch_id} parity incomplete`,
      );
      assert.ok(result.summary.row_count > 0);
    }
  });
});
