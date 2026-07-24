import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { ExhibitorImportHttpError } from "./errors";
import {
  summarizeMaterializeCompaniesChunkResult,
  withImportToDraftPipelineLog,
} from "./importToDraftPipelineLog";

describe("withImportToDraftPipelineLog", () => {
  const originalInfo = console.info;
  const originalError = console.error;

  afterEach(() => {
    console.info = originalInfo;
    console.error = originalError;
    mock.restoreAll();
  });

  it("logs start and success with duration and progress", async () => {
    const infoCalls: unknown[][] = [];
    console.info = (...args: unknown[]) => {
      infoCalls.push(args);
    };
    console.error = () => {};

    const result = await withImportToDraftPipelineLog(
      {
        batchId: "batch-1",
        phase: "materialize_companies_chunk",
        actorId: "user-1",
        cursor: 10,
        limit: 25,
      },
      async () => ({
        examined_count: 25,
        skipped_count: 0,
        materialized_count: 25,
        companies_created: 20,
        total_resolved_rows: 100,
        rows_with_company_id: 35,
        done: false,
        next_cursor: 35,
      }),
      summarizeMaterializeCompaniesChunkResult,
    );

    assert.equal(result.done, false);
    assert.equal(infoCalls.length, 2);
    assert.equal(infoCalls[0]?.[0], "[exhibitor-import/import-to-draft]");
    assert.deepEqual(infoCalls[0]?.[1], {
      event: "start",
      batchId: "batch-1",
      phase: "materialize_companies_chunk",
      actorId: "user-1",
      cursor: 10,
      limit: 25,
      startedAt: (infoCalls[0]?.[1] as { startedAt?: string } | undefined)?.startedAt,
    });
    assert.match(
      String((infoCalls[0]?.[1] as { startedAt?: string } | undefined)?.startedAt),
      /^\d{4}-\d{2}-\d{2}T/,
    );

    const successPayload = infoCalls[1]?.[1] as Record<string, unknown>;
    assert.equal(successPayload.event, "success");
    assert.equal(successPayload.batchId, "batch-1");
    assert.equal(successPayload.phase, "materialize_companies_chunk");
    assert.equal(typeof successPayload.durationMs, "number");
    assert.deepEqual(successPayload.processed, {
      examined_count: 25,
      skipped_count: 0,
      materialized_count: 25,
      companies_created: 20,
    });
    assert.deepEqual(successPayload.progress, {
      total_resolved_rows: 100,
      rows_with_company_id: 35,
      done: false,
      next_cursor: 35,
    });
  });

  it("logs structured errors and rethrows", async () => {
    console.info = () => {};
    const errorCalls: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      errorCalls.push(args);
    };

    await assert.rejects(
      () =>
        withImportToDraftPipelineLog(
          {
            batchId: "batch-2",
            phase: "import_to_draft_finalize",
            actorId: "user-2",
          },
          async () => {
            throw new ExhibitorImportHttpError(409, "Already in progress.", {
              processing_phase: "importing_to_draft",
            });
          },
          summarizeMaterializeCompaniesChunkResult,
        ),
      /Already in progress\./,
    );

    assert.equal(errorCalls.length, 1);
    const errorPayload = errorCalls[0]?.[1] as Record<string, unknown>;
    assert.equal(errorPayload.event, "error");
    assert.equal(errorPayload.batchId, "batch-2");
    assert.equal(errorPayload.phase, "import_to_draft_finalize");
    assert.equal(errorPayload.errorMessage, "Already in progress.");
    assert.equal(errorPayload.errorStatus, 409);
    assert.deepEqual(errorPayload.errorDetails, {
      processing_phase: "importing_to_draft",
    });
    assert.equal(typeof errorPayload.durationMs, "number");
  });
});
