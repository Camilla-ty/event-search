import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ParsedSpreadsheetRow } from "../types";
import {
  type BatchRow,
  IMPORT_IN_PROGRESS_REVIEW_MESSAGE,
  MAPPING_IN_PROGRESS_REVIEW_MESSAGE,
  MATCHING_IN_PROGRESS_MUTATION_MESSAGE,
  STALE_IMPORT_TO_DRAFT_MS,
  STALE_PARSING_CLAIM_MS,
  STALE_VALIDATING_CLAIM_MS,
  VALIDATION_IN_PROGRESS_REVIEW_MESSAGE,
} from "./batchGuards";
import { SponsorImportHttpError } from "./errors";
import { isMatchingRunCurrent } from "./matchRunPolicy";
import {
  assertImportToDraftNotBlockedByProcessingPhase,
  COLUMN_MAPPING_IN_PROGRESS_MESSAGE,
  COLUMN_MAPPING_SUPERSEDED_MESSAGE,
  IMPORT_IN_PROGRESS_MAPPING_MESSAGE,
  IMPORT_IN_PROGRESS_VALIDATION_MESSAGE,
  MAPPING_AFTER_DRAFT_LINKS_MESSAGE,
  prepareReviewMutationWithDeps,
  recoverStaleImportProcessingPhaseWithDeps,
  runBatchMatchingWithDeps,
  runBatchValidationWithDeps,
  saveColumnMappingWithDeps,
  VALIDATION_AFTER_DRAFT_LINKS_MESSAGE,
  VALIDATION_IN_PROGRESS_MESSAGE,
  VALIDATION_SUPERSEDED_MESSAGE,
  type RecoverStaleImportProcessingPhaseDeps,
  type RunBatchMatchingDeps,
  type RunBatchValidationDeps,
  type SaveColumnMappingDeps,
} from "./sponsorImportAdmin";

const START_MS = Date.parse("2026-11-18T09:00:00.000Z");

/** `timestamp without time zone` text as PostgREST returns it (UTC, no zone suffix). */
function dbTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace("Z", "");
}

function parsedRow(excelRowNumber: number, name: string): ParsedSpreadsheetRow {
  return {
    excelRowNumber,
    rawCompanyName: name,
    rawWebsite: `https://${name}.example`,
    rawTierRank: 1,
    rawTierLabel: "Gold",
    rawNotes: null,
  };
}

type FakeBatchSnapshot = {
  processing_phase: string | null;
  source_sheet_name: string | null;
  source_row_count: number | null;
};

type Hooks = {
  duringDownload?: () => Promise<void> | void;
  duringInsert?: () => Promise<void> | void;
  duringValidationRowUpdate?: () => Promise<void> | void;
  beforeImportRecoveryClear?: () => Promise<void> | void;
  failDownload?: boolean;
  failParse?: boolean;
  failDelete?: boolean;
  failInsert?: boolean;
  failSave?: boolean;
  failLog?: boolean;
  failRelease?: boolean;
  failValidationRowUpdate?: boolean;
};

/**
 * In-memory batch whose claim semantics mirror the Supabase queries: while a workflow holds
 * `phase`, `updatedAt` is its claim token, and phase-clearing writes only succeed while the
 * caller's token still matches.
 */
function createFakeBatch() {
  const state = {
    nowMs: START_MS,
    status: "review" as string,
    phase: null as string | null,
    updatedAt: dbTimestamp(START_MS - 60 * 60 * 1000),
    rows: ["old-a", "old-b"],
    sheetName: null as string | null,
    rowCount: null as number | null,
    actions: [] as string[],
    /** Phase observed at each mapping step, to prove the claim is held throughout. */
    phaseDuring: {} as Record<string, string | null>,
    downloads: 0,
    releaseCalls: 0,
    matchingClaims: 0,
    takeovers: 0,
    validationReleaseCalls: 0,
    validatedRows: [] as string[],
    /** Row status by row id; rows without an entry are `needs_review`. */
    rowStatuses: {} as Record<string, string>,
    /** Like `transitionToReview` on the mapping route: the status a successful save writes. */
    mappingTransitionsToReview: false,
    draftLinks: 0,
    importRecoveries: 0,
  };
  const hooks: Hooks = {};
  let parsedRows = [parsedRow(2, "new-a"), parsedRow(3, "new-b"), parsedRow(4, "new-c")];
  /** The status each mapping claim will write, computed when the save starts, as in the wrapper. */
  const mappingNextStatusByToken = new Map<string, string>();
  const rowStatus = (rowId: string) => state.rowStatuses[rowId] ?? "needs_review";

  const issueToken = () => {
    state.nowMs += 1;
    return new Date(state.nowMs).toISOString();
  };

  const snapshot = (): FakeBatchSnapshot => ({
    processing_phase: state.phase,
    source_sheet_name: state.sheetName,
    source_row_count: state.rowCount,
  });

  const recordMappingNextStatus = (token: string, statusAtStart: string) => {
    mappingNextStatusByToken.set(token, state.mappingTransitionsToReview ? "review" : statusAtStart);
  };

  const mappingDeps: SaveColumnMappingDeps<FakeBatchSnapshot> = {
    claimParsingPhase: async () => {
      if (state.status !== "uploaded" && state.status !== "review") return null;
      if (state.phase !== null) return null;
      state.phase = "parsing";
      state.updatedAt = issueToken();
      recordMappingNextStatus(state.updatedAt, state.status);
      return state.updatedAt;
    },
    readParsingClaim: async () => ({ processing_phase: state.phase, updated_at: state.updatedAt }),
    takeOverStaleClaim: async (phase, staleToken) => {
      if (state.status !== "uploaded" && state.status !== "review") return null;
      if (state.phase !== phase || state.updatedAt !== staleToken) return null;
      state.phase = "parsing";
      state.updatedAt = issueToken();
      state.takeovers += 1;
      recordMappingNextStatus(state.updatedAt, state.status);
      return state.updatedAt;
    },
    countDraftLinks: async () => state.draftLinks,
    downloadSourceFile: async () => {
      state.phaseDuring.download = state.phase;
      state.downloads += 1;
      await hooks.duringDownload?.();
      if (hooks.failDownload) throw new Error("Failed to download source file.");
      return new ArrayBuffer(0);
    },
    parseRows: () => {
      state.phaseDuring.parse = state.phase;
      if (hooks.failParse) throw new Error("Spreadsheet has more than 500 rows.");
      return { rows: parsedRows, sheetName: "Sponsors" };
    },
    deleteRows: async () => {
      state.phaseDuring.delete = state.phase;
      if (hooks.failDelete) throw new Error("delete failed");
      state.rows = [];
      state.rowStatuses = {};
    },
    insertRows: async (rows) => {
      state.phaseDuring.insert = state.phase;
      await hooks.duringInsert?.();
      if (hooks.failInsert) throw new Error("insert failed");
      state.rows = rows.map((r) => r.rawCompanyName ?? "");
      state.rowStatuses = {};
    },
    saveMappingAndReleaseClaim: async (token, { sheetName, rowCount }) => {
      state.phaseDuring.save = state.phase;
      if (hooks.failSave) throw new Error("batch update failed");
      if (state.phase !== "parsing" || state.updatedAt !== token) return null;
      state.sheetName = sheetName;
      state.rowCount = rowCount;
      state.status = mappingNextStatusByToken.get(token) ?? state.status;
      state.phase = null;
      state.updatedAt = issueToken();
      return snapshot();
    },
    releaseParsingClaim: async (token) => {
      state.releaseCalls += 1;
      if (hooks.failRelease) throw new Error("release failed");
      if (state.phase !== "parsing" || state.updatedAt !== token) return;
      state.phase = null;
      state.updatedAt = issueToken();
    },
    logMappingSaved: async () => {
      if (hooks.failLog) throw new Error("Failed to write action log: insert failed");
      state.actions.push("column_mapping_saved");
    },
    now: () => state.nowMs,
  };

  /** Validation over the same batch; its claim, like the Supabase query, needs an idle batch or an earlier validation. */
  const validationDeps: RunBatchValidationDeps = {
    claimValidatingPhase: async () => {
      if (state.status !== "uploaded" && state.status !== "review") return null;
      if (state.phase !== null && state.phase !== "validating") return null;
      state.phase = "validating";
      state.updatedAt = issueToken();
      return state.updatedAt;
    },
    readClaimState: async () => ({ status: state.status, processing_phase: state.phase }),
    countDraftLinks: async () => state.draftLinks,
    loadRows: async () =>
      state.rows.map((name, index) => ({
        id: name,
        excel_row_number: index + 2,
        raw_company_name: name,
        raw_website: `https://${name}.example`,
        raw_tier_rank: 1,
        raw_tier_label: "Gold",
        status: rowStatus(name),
      })),
    updateRowIfStatusUnchanged: async (rowId, readStatus, patch) => {
      await hooks.duringValidationRowUpdate?.();
      if (hooks.failValidationRowUpdate) throw new Error("row update failed");
      if (!state.rows.includes(rowId) || rowStatus(rowId) !== readStatus) return false;
      state.rowStatuses[rowId] = String(patch.status);
      state.validatedRows.push(rowId);
      return true;
    },
    finishValidation: async (token) => {
      if (state.status !== "uploaded" && state.status !== "review") return false;
      if (state.phase !== "validating" || state.updatedAt !== token) return false;
      state.status = "review";
      state.phase = null;
      state.updatedAt = issueToken();
      return true;
    },
    releaseValidatingClaim: async (token) => {
      state.validationReleaseCalls += 1;
      if (state.phase !== "validating" || state.updatedAt !== token) return;
      state.phase = null;
      state.updatedAt = issueToken();
    },
    logValidationRun: async () => {
      state.actions.push("validation_run");
    },
  };

  /** Matching over the same batch; its claim, like the Supabase query, requires phase null. */
  const matchingDeps: RunBatchMatchingDeps = {
    readMatchingClaim: async () => ({ processing_phase: state.phase, updated_at: state.updatedAt }),
    hasCurrentMatchingRun: async () => isMatchingRunCurrent(state.actions.at(-1) ?? null),
    latestMatchingRunAffectedCount: async () => 0,
    latestMatchingRunClaimToken: async () => null,
    claimMatchingPhase: async () => {
      if (state.phase !== null) return null;
      state.phase = "matching";
      state.updatedAt = issueToken();
      state.matchingClaims += 1;
      return state.updatedAt;
    },
    renewMatchingClaim: async (token) => {
      if (state.phase !== "matching" || state.updatedAt !== token) return null;
      state.updatedAt = issueToken();
      return state.updatedAt;
    },
    releaseMatchingClaim: async (token) => {
      if (state.phase !== "matching" || state.updatedAt !== token) return false;
      state.phase = null;
      state.updatedAt = issueToken();
      return true;
    },
    loadMatchableRows: async () => [],
    createMatcher: async () => async () => {
      throw new Error("no rows should be matched in these tests");
    },
    updateRowIfStillMatchable: async () => false,
    appendMatchingRunLog: async () => {
      state.actions.push("matching_run");
    },
    now: () => state.nowMs,
  };

  type ImportPhase = "materializing_companies" | "importing_to_draft";

  /**
   * Import pipeline claims and finalisation, mirroring their Supabase filters: claims need
   * `status = review` and an idle batch; finalisation runs the real phase guard, then
   * `.eq("status", "review").is("processing_phase", null)`.
   */
  const importOps = {
    claim: (phase: ImportPhase): string | null => {
      if (state.status !== "review" || state.phase !== null) return null;
      state.phase = phase;
      state.updatedAt = issueToken();
      return state.updatedAt;
    },
    release: (phase: ImportPhase) => {
      if (state.status !== "review" || state.phase !== phase) return;
      state.phase = null;
      state.updatedAt = issueToken();
    },
    finalizeUpdate: (): boolean => {
      if (state.status !== "review" || state.phase !== null) return false;
      state.status = "draft";
      state.updatedAt = issueToken();
      return true;
    },
    finalize: (): boolean => {
      assertImportToDraftNotBlockedByProcessingPhase({ processing_phase: state.phase });
      return importOps.finalizeUpdate();
    },
    /** An in-progress chunk re-entering its own phase refreshes `updated_at`, as the chunk routes do. */
    touch: (phase: ImportPhase) => {
      if (state.status !== "review" || state.phase !== phase) return;
      state.updatedAt = issueToken();
    },
  };

  /** Stale import recovery deps, mirroring the Supabase compare-and-swap clear. */
  const importRecoveryDeps: RecoverStaleImportProcessingPhaseDeps = {
    countDraftLinks: async () => state.draftLinks,
    clearStaleClaim: async (phase, staleUpdatedAt) => {
      await hooks.beforeImportRecoveryClear?.();
      if (state.status !== "review" || state.phase !== phase || state.updatedAt !== staleUpdatedAt) {
        return false;
      }
      state.phase = null;
      state.updatedAt = issueToken();
      state.importRecoveries += 1;
      return true;
    },
    now: () => state.nowMs,
  };

  /**
   * Review row decisions: `decide` runs the real preparation (status check, stale import
   * recovery, phase guard) first, as the Review mutations do; `decideUpdate` is the row write
   * alone, for a request that passed its guard earlier.
   */
  const reviewOps = {
    decideUpdate: (rowId: string, status: "resolved" | "excluded") => {
      if (state.rows.includes(rowId)) state.rowStatuses[rowId] = status;
    },
    decide: async (rowId: string, status: "resolved" | "excluded") => {
      await prepareReviewMutationWithDeps({
        readBatch: async () => ({
          id: "batch-1",
          event_edition_id: "edition-1",
          status: state.status as BatchRow["status"],
          review_acknowledged_at: null,
          processing_phase: state.phase,
          updated_at: state.updatedAt,
        }),
        recoverStaleImportClaim: (batch) => recoverStaleImportProcessingPhaseWithDeps(batch, importRecoveryDeps),
      });
      reviewOps.decideUpdate(rowId, status);
    },
  };

  return {
    state,
    hooks,
    mappingDeps,
    validationDeps,
    matchingDeps,
    importOps,
    reviewOps,
    setParsedRows: (rows: ParsedSpreadsheetRow[]) => {
      parsedRows = rows;
    },
  };
}

async function assertConflict(promise: Promise<unknown>, message: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SponsorImportHttpError, "expected a SponsorImportHttpError");
    assert.equal(error.status, 409);
    assert.equal(error.message, message);
    return true;
  });
}

async function captureError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  return null;
}

function assertConflictError(error: unknown, message: string) {
  assert.ok(error instanceof SponsorImportHttpError, `expected a 409 "${message}"`);
  assert.equal(error.status, 409);
  assert.equal(error.message, message);
}

describe("saveColumnMappingWithDeps — parsing claim", () => {
  it("claims parsing before download, holds it while rows are replaced, and releases it on success", async () => {
    const { state, mappingDeps } = createFakeBatch();

    const saved = await saveColumnMappingWithDeps(mappingDeps);

    assert.deepEqual(state.phaseDuring, {
      download: "parsing",
      parse: "parsing",
      delete: "parsing",
      insert: "parsing",
      save: "parsing",
    });
    assert.deepEqual(state.rows, ["new-a", "new-b", "new-c"]);
    assert.equal(state.rowCount, 3);
    assert.equal(state.sheetName, "Sponsors");
    assert.equal(state.phase, null, "the parsing claim must be released");
    assert.equal(saved.processing_phase, null, "the returned batch must not show a parsing phase");
    assert.deepEqual(state.actions, ["column_mapping_saved"]);
    assert.equal(state.releaseCalls, 0, "success releases in the final batch update");
  });

  it("releases the claim when the mapping produces no rows", async () => {
    const { state, mappingDeps, setParsedRows } = createFakeBatch();
    setParsedRows([]);

    await saveColumnMappingWithDeps(mappingDeps);

    assert.deepEqual(state.rows, []);
    assert.equal(state.rowCount, 0);
    assert.equal(state.phase, null);
  });

  const blockingClaims: Array<[phase: string, message: string, ageMs: number, label: string]> = [
    ["matching", MATCHING_IN_PROGRESS_MUTATION_MESSAGE, 1000, "active"],
    ["matching", MATCHING_IN_PROGRESS_MUTATION_MESSAGE, 2 * STALE_PARSING_CLAIM_MS, "abandoned"],
    ["validating", VALIDATION_IN_PROGRESS_MESSAGE, 1000, "active"],
    ["validating", VALIDATION_IN_PROGRESS_MESSAGE, STALE_VALIDATING_CLAIM_MS - 1000, "nearly stale"],
    ["materializing_companies", IMPORT_IN_PROGRESS_MAPPING_MESSAGE, 1000, "active"],
    ["materializing_companies", IMPORT_IN_PROGRESS_MAPPING_MESSAGE, 2 * STALE_PARSING_CLAIM_MS, "abandoned"],
    ["importing_to_draft", IMPORT_IN_PROGRESS_MAPPING_MESSAGE, 1000, "active"],
    ["importing_to_draft", IMPORT_IN_PROGRESS_MAPPING_MESSAGE, 2 * STALE_PARSING_CLAIM_MS, "abandoned"],
  ];

  for (const [phase, message, ageMs, label] of blockingClaims) {
    it(`is rejected during an ${label} ${phase} claim, without overwriting it or touching rows`, async () => {
      const { state, mappingDeps } = createFakeBatch();
      state.phase = phase;
      state.updatedAt = dbTimestamp(state.nowMs - ageMs);
      const otherToken = state.updatedAt;

      await assertConflict(saveColumnMappingWithDeps(mappingDeps), message);

      assert.equal(state.downloads, 0);
      assert.deepEqual(state.rows, ["old-a", "old-b"]);
      assert.equal(state.phase, phase);
      assert.equal(state.updatedAt, otherToken, "the other workflow's claim token must be untouched");
      assert.equal(state.takeovers, 0);
      assert.equal(state.releaseCalls, 0);
      assert.deepEqual(state.actions, []);
    });
  }

  it("is rejected while another mapping save holds a live parsing claim", async () => {
    const { state, mappingDeps } = createFakeBatch();
    state.phase = "parsing";
    state.updatedAt = dbTimestamp(state.nowMs - STALE_PARSING_CLAIM_MS + 1000);

    await assertConflict(saveColumnMappingWithDeps(mappingDeps), COLUMN_MAPPING_IN_PROGRESS_MESSAGE);

    assert.equal(state.downloads, 0);
    assert.equal(state.phase, "parsing");
  });

  it("takes over an abandoned parsing claim and releases it", async () => {
    const { state, mappingDeps } = createFakeBatch();
    state.phase = "parsing";
    state.updatedAt = dbTimestamp(state.nowMs - STALE_PARSING_CLAIM_MS);

    await saveColumnMappingWithDeps(mappingDeps);

    assert.equal(state.phaseDuring.download, "parsing");
    assert.deepEqual(state.rows, ["new-a", "new-b", "new-c"]);
    assert.equal(state.phase, null);
  });

  for (const stalePhase of ["parsing", "validating"] as const) {
    it(`loses a concurrent ${stalePhase} takeover cleanly when another save took the claim first`, async () => {
      const { state, mappingDeps } = createFakeBatch();
      state.phase = stalePhase;
      state.updatedAt = dbTimestamp(state.nowMs - 2 * STALE_PARSING_CLAIM_MS);
      const competitor: { token: string | null } = { token: null };
      const deps: SaveColumnMappingDeps<unknown> = {
        ...mappingDeps,
        takeOverStaleClaim: async (phase, staleToken) => {
          // The competing request read the same stale claim and wins the conditional update.
          competitor.token = await mappingDeps.takeOverStaleClaim(phase, staleToken);
          assert.notEqual(competitor.token, null, "the competing takeover must win");
          return mappingDeps.takeOverStaleClaim(phase, staleToken);
        },
      };

      await assertConflict(saveColumnMappingWithDeps(deps), COLUMN_MAPPING_IN_PROGRESS_MESSAGE);

      assert.equal(state.takeovers, 1, "only one request may take over a stale claim");
      assert.equal(state.downloads, 0);
      assert.equal(state.phase, "parsing");
      assert.equal(state.updatedAt, competitor.token, "the winner's claim token must be untouched");
    });
  }

  it("takes over an abandoned validating claim, replaces rows, and releases", async () => {
    const { state, mappingDeps } = createFakeBatch();
    state.status = "uploaded";
    state.phase = "validating";
    state.updatedAt = dbTimestamp(state.nowMs - STALE_VALIDATING_CLAIM_MS);

    await saveColumnMappingWithDeps(mappingDeps);

    assert.equal(state.takeovers, 1);
    assert.equal(state.phaseDuring.download, "parsing");
    assert.deepEqual(state.rows, ["new-a", "new-b", "new-c"]);
    assert.equal(state.phase, null);
    assert.equal(state.status, "uploaded");
    assert.deepEqual(state.actions, ["column_mapping_saved"]);
  });

  it("a second save during a validating takeover is rejected as a live mapping save", async () => {
    const { state, hooks, mappingDeps } = createFakeBatch();
    state.phase = "validating";
    state.updatedAt = dbTimestamp(state.nowMs - STALE_VALIDATING_CLAIM_MS);
    const outcome: { error: unknown } = { error: null };
    hooks.duringDownload = async () => {
      if (state.downloads > 1) return;
      outcome.error = await captureError(() => saveColumnMappingWithDeps(mappingDeps));
    };

    await saveColumnMappingWithDeps(mappingDeps);

    assertConflictError(outcome.error, COLUMN_MAPPING_IN_PROGRESS_MESSAGE);
    assert.equal(state.takeovers, 1);
    assert.equal(state.downloads, 1);
    assert.equal(state.phase, null);
  });
});

describe("saveColumnMappingWithDeps — after Import to draft created links", () => {
  it("is rejected with a clear message, keeping every row and releasing its claim", async () => {
    const { state, mappingDeps } = createFakeBatch();
    state.draftLinks = 2;

    await assertConflict(saveColumnMappingWithDeps(mappingDeps), MAPPING_AFTER_DRAFT_LINKS_MESSAGE);

    assert.deepEqual(state.rows, ["old-a", "old-b"], "rows referenced by draft links are kept");
    assert.equal(state.draftLinks, 2, "draft links are kept");
    assert.equal(state.downloads, 0, "the file is not even downloaded");
    assert.equal(state.phase, null, "the parsing claim is released");
    assert.equal(state.releaseCalls, 1);
    assert.deepEqual(state.actions, []);
  });

  it("is rejected the same way after taking over an abandoned validating claim", async () => {
    const { state, mappingDeps } = createFakeBatch();
    state.phase = "validating";
    state.updatedAt = dbTimestamp(state.nowMs - STALE_VALIDATING_CLAIM_MS);
    state.draftLinks = 1;

    await assertConflict(saveColumnMappingWithDeps(mappingDeps), MAPPING_AFTER_DRAFT_LINKS_MESSAGE);

    assert.equal(state.takeovers, 1);
    assert.deepEqual(state.rows, ["old-a", "old-b"]);
    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, []);
  });
});

describe("saveColumnMappingWithDeps — release on failure", () => {
  const failures: Array<{ step: keyof Hooks; message: string; rowsAfter: string[] }> = [
    { step: "failDownload", message: "Failed to download source file.", rowsAfter: ["old-a", "old-b"] },
    { step: "failParse", message: "Spreadsheet has more than 500 rows.", rowsAfter: ["old-a", "old-b"] },
    { step: "failDelete", message: "delete failed", rowsAfter: ["old-a", "old-b"] },
    { step: "failInsert", message: "insert failed", rowsAfter: [] },
    { step: "failSave", message: "batch update failed", rowsAfter: ["new-a", "new-b", "new-c"] },
  ];

  for (const { step, message, rowsAfter } of failures) {
    it(`releases the parsing claim and rethrows when ${step.replace("fail", "").toLowerCase()} fails`, async () => {
      const { state, hooks, mappingDeps } = createFakeBatch();
      hooks[step] = true as never;

      await assert.rejects(saveColumnMappingWithDeps(mappingDeps), { message });

      assert.equal(state.phase, null, "the parsing claim must not outlive a failed save");
      assert.equal(state.releaseCalls, 1);
      assert.deepEqual(state.rows, rowsAfter);
      assert.deepEqual(state.actions, [], "a failed save must not log column_mapping_saved");
    });
  }

  it("surfaces the original error when releasing the claim also fails", async () => {
    const { state, hooks, mappingDeps } = createFakeBatch();
    hooks.failInsert = true;
    hooks.failRelease = true;

    await assert.rejects(saveColumnMappingWithDeps(mappingDeps), { message: "insert failed" });
    assert.equal(state.phase, "parsing", "an unreleased claim stays until it goes stale");
  });

  it("does not release again when only the action log fails after the batch save", async () => {
    const { state, hooks, mappingDeps } = createFakeBatch();
    hooks.failLog = true;

    await assert.rejects(saveColumnMappingWithDeps(mappingDeps), {
      message: "Failed to write action log: insert failed",
    });
    assert.equal(state.phase, null);
    assert.equal(state.releaseCalls, 0);
    assert.equal(state.rowCount, 3);
  });

  it("never clears a parsing claim that a later mapping save took over", async () => {
    const { state, hooks, mappingDeps } = createFakeBatch();
    hooks.duringDownload = () => {
      state.updatedAt = new Date(state.nowMs + 5).toISOString();
    };
    hooks.failDownload = true;

    await assert.rejects(saveColumnMappingWithDeps(mappingDeps), { message: "Failed to download source file." });
    assert.equal(state.phase, "parsing");
  });

  it("writes nothing to the batch and reports it was superseded when its claim was taken over mid-save", async () => {
    const { state, hooks, mappingDeps } = createFakeBatch();
    state.status = "uploaded";
    state.mappingTransitionsToReview = true;
    const newOwnerToken = new Date(START_MS + 60_000).toISOString();
    hooks.duringInsert = () => {
      state.updatedAt = newOwnerToken;
    };

    await assertConflict(saveColumnMappingWithDeps(mappingDeps), COLUMN_MAPPING_SUPERSEDED_MESSAGE);

    assert.equal(state.rowCount, null, "a superseded save must not write the mapping fields");
    assert.equal(state.sheetName, null);
    assert.equal(state.status, "uploaded", "a superseded save must not write the batch status");
    assert.equal(state.phase, "parsing");
    assert.equal(state.updatedAt, newOwnerToken, "the new owner's claim token must be untouched");
    assert.equal(state.releaseCalls, 0, "a superseded save has no claim to release");
    assert.deepEqual(state.actions, [], "a superseded save must not log column_mapping_saved");
  });

  it("an old mapping save whose claim was taken over cannot revert a finalized draft batch", async () => {
    const { state, hooks, mappingDeps, importOps } = createFakeBatch();
    state.mappingTransitionsToReview = true;
    const outcome: { takeoverRan: boolean; finalized: boolean | null } = {
      takeoverRan: false,
      finalized: null,
    };
    hooks.duringInsert = async () => {
      if (outcome.takeoverRan) return;
      outcome.takeoverRan = true;
      // The first save stalls past the stale threshold; a second save takes over and finishes,
      // and the batch is then finalized before the first save resumes.
      state.nowMs += STALE_PARSING_CLAIM_MS;
      await saveColumnMappingWithDeps(mappingDeps);
      outcome.finalized = importOps.finalize();
    };

    await assertConflict(saveColumnMappingWithDeps(mappingDeps), COLUMN_MAPPING_SUPERSEDED_MESSAGE);

    assert.equal(state.takeovers, 1);
    assert.equal(outcome.finalized, true, "the batch must have been finalized while the old save stalled");
    assert.equal(state.status, "draft", "the old save must not revert the draft batch to review");
    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, ["column_mapping_saved"], "only the save that took over logs");
  });
});

describe("runBatchValidationWithDeps — validating claim", () => {
  it("claims validating, validates every row, then clears its own claim and logs validation_run", async () => {
    const { state, validationDeps } = createFakeBatch();
    state.status = "uploaded";

    const result = await runBatchValidationWithDeps(validationDeps);

    assert.deepEqual(result, { validated_count: 2 });
    assert.deepEqual(state.validatedRows, ["old-a", "old-b"]);
    assert.equal(state.status, "review");
    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, ["validation_run"]);
  });

  it("is rejected while matching holds the batch", async () => {
    const { state, validationDeps } = createFakeBatch();
    state.phase = "matching";
    const matchingToken = state.updatedAt;

    await assertConflict(runBatchValidationWithDeps(validationDeps), MATCHING_IN_PROGRESS_MUTATION_MESSAGE);

    assert.equal(state.phase, "matching");
    assert.equal(state.updatedAt, matchingToken);
    assert.deepEqual(state.validatedRows, []);
  });

  it("cannot overwrite a mapping save's parsing claim", async () => {
    const { state, validationDeps } = createFakeBatch();
    state.phase = "parsing";
    const mappingToken = state.updatedAt;

    await assertConflict(runBatchValidationWithDeps(validationDeps), COLUMN_MAPPING_IN_PROGRESS_MESSAGE);

    assert.equal(state.phase, "parsing");
    assert.equal(state.updatedAt, mappingToken, "the mapping claim token must be untouched");
    assert.deepEqual(state.validatedRows, []);
    assert.deepEqual(state.actions, []);
  });

  for (const phase of ["materializing_companies", "importing_to_draft"]) {
    for (const [label, ageMs] of [
      ["active", 1000],
      ["abandoned", 2 * STALE_VALIDATING_CLAIM_MS],
    ] as const) {
      it(`cannot overwrite an ${label} ${phase} claim`, async () => {
        const { state, validationDeps } = createFakeBatch();
        state.phase = phase;
        state.updatedAt = dbTimestamp(state.nowMs - ageMs);
        const importToken = state.updatedAt;

        await assertConflict(runBatchValidationWithDeps(validationDeps), IMPORT_IN_PROGRESS_VALIDATION_MESSAGE);

        assert.equal(state.phase, phase);
        assert.equal(state.updatedAt, importToken, "the import claim token must be untouched");
        assert.deepEqual(state.validatedRows, []);
        assert.deepEqual(state.actions, []);
      });
    }
  }

  it("still claims over a previous validating phase, as before", async () => {
    const { state, validationDeps } = createFakeBatch();
    state.phase = "validating";

    await runBatchValidationWithDeps(validationDeps);

    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, ["validation_run"]);
  });

  for (const initialStatus of ["uploaded", "review"]) {
    it(`a ${initialStatus} validation whose claim was taken over writes nothing and reports it was superseded`, async () => {
      const { state, hooks, validationDeps } = createFakeBatch();
      state.status = initialStatus;
      const otherToken = new Date(START_MS + 60_000).toISOString();
      hooks.duringValidationRowUpdate = () => {
        state.phase = "parsing";
        state.updatedAt = otherToken;
      };

      await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_SUPERSEDED_MESSAGE);

      assert.equal(state.phase, "parsing", "validation must never clear another workflow's claim");
      assert.equal(state.updatedAt, otherToken, "the other workflow's claim token must be untouched");
      assert.equal(state.status, initialStatus, "a superseded validation must not change the batch status");
      assert.deepEqual(state.actions, [], "a superseded validation must not log validation_run");
      assert.equal(state.validationReleaseCalls, 0, "a superseded validation has no claim to release");
    });
  }

  it("releases its own claim when a row update fails", async () => {
    const { state, hooks, validationDeps } = createFakeBatch();
    hooks.failValidationRowUpdate = true;

    await assert.rejects(runBatchValidationWithDeps(validationDeps), { message: "row update failed" });

    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, []);
  });

  it("a failing validation cannot release a claim that is no longer its own", async () => {
    const { state, hooks, validationDeps } = createFakeBatch();
    hooks.duringValidationRowUpdate = () => {
      state.phase = "parsing";
      state.updatedAt = new Date(state.nowMs + 5).toISOString();
    };
    hooks.failValidationRowUpdate = true;

    await assert.rejects(runBatchValidationWithDeps(validationDeps), { message: "row update failed" });

    assert.equal(state.phase, "parsing");
  });

  it("an overlapping validation keeps its claim when the earlier one is superseded", async () => {
    const { state, hooks, validationDeps } = createFakeBatch();
    state.status = "uploaded";
    const laterToken = new Date(START_MS + 60_000).toISOString();
    hooks.duringValidationRowUpdate = () => {
      state.phase = "validating";
      state.updatedAt = laterToken;
    };

    await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_SUPERSEDED_MESSAGE);

    assert.equal(state.phase, "validating", "the later validation still owns the batch");
    assert.equal(state.updatedAt, laterToken, "the later validation must still be able to release");
    assert.equal(state.status, "uploaded", "only the owning validation moves the batch to review");
    assert.deepEqual(state.actions, []);
  });
});

describe("Review decisions during validation and mapping", () => {
  it("a decision during validation is rejected, and validation finishes without losing it", async () => {
    const { state, hooks, validationDeps, reviewOps } = createFakeBatch();
    state.rowStatuses["old-b"] = "auto_ready";
    const outcome: { error: unknown } = { error: null };
    hooks.duringValidationRowUpdate = async () => {
      if (outcome.error !== null) return;
      outcome.error = await captureError(() => reviewOps.decide("old-b", "resolved"));
    };

    await runBatchValidationWithDeps(validationDeps);

    assertConflictError(outcome.error, VALIDATION_IN_PROGRESS_REVIEW_MESSAGE);
    assert.equal(state.rowStatuses["old-b"], "auto_ready");
    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, ["validation_run"]);
  });

  it("a decision that passed its guard before validation claimed is not overwritten by the stale status", async () => {
    const { state, hooks, validationDeps, reviewOps } = createFakeBatch();
    state.rowStatuses["old-b"] = "auto_ready";
    const outcome: { decided: boolean } = { decided: false };
    hooks.duringValidationRowUpdate = () => {
      if (outcome.decided) return;
      outcome.decided = true;
      // Validation has already read old-b as auto_ready; the reviewer's write lands first.
      reviewOps.decideUpdate("old-b", "resolved");
    };

    await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_SUPERSEDED_MESSAGE);

    assert.equal(state.rowStatuses["old-b"], "resolved", "the reviewer's decision must survive");
    assert.equal(state.status, "review");
    assert.equal(state.phase, null, "validation must release its own claim");
    assert.equal(state.validationReleaseCalls, 1);
    assert.deepEqual(state.actions, [], "an interrupted validation must not log validation_run");

    await runBatchValidationWithDeps(validationDeps);
    assert.equal(state.rowStatuses["old-b"], "resolved", "a re-run keeps the reviewer's decision");
    assert.deepEqual(state.actions, ["validation_run"]);
  });

  it("an interrupted uploaded-batch validation leaves the status uploaded", async () => {
    const { state, hooks, validationDeps, reviewOps } = createFakeBatch();
    state.status = "uploaded";
    hooks.duringValidationRowUpdate = () => {
      reviewOps.decideUpdate("old-b", "excluded");
    };

    await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_SUPERSEDED_MESSAGE);

    assert.equal(state.status, "uploaded");
    assert.equal(state.phase, null);
  });

  it("a decision during a mapping save is rejected", async () => {
    const { state, hooks, mappingDeps, reviewOps } = createFakeBatch();
    const outcome: { error: unknown } = { error: null };
    hooks.duringInsert = async () => {
      outcome.error = await captureError(() => reviewOps.decide("old-a", "resolved"));
    };

    await saveColumnMappingWithDeps(mappingDeps);

    assertConflictError(outcome.error, MAPPING_IN_PROGRESS_REVIEW_MESSAGE);
    assert.equal(state.phase, null);
  });
});

describe("Review decisions after a failed import chunk", () => {
  for (const phase of ["materializing_companies", "importing_to_draft"] as const) {
    it(`an active ${phase} claim still blocks decisions and is left untouched`, async () => {
      const { state, importOps, reviewOps } = createFakeBatch();
      state.draftLinks = phase === "importing_to_draft" ? 1 : 0;
      const importToken = importOps.claim(phase);
      state.nowMs += STALE_IMPORT_TO_DRAFT_MS - 1000;

      await assertConflict(reviewOps.decide("old-a", "excluded"), IMPORT_IN_PROGRESS_REVIEW_MESSAGE);

      assert.equal(state.phase, phase);
      assert.equal(state.updatedAt, importToken, "the live import claim token must be untouched");
      assert.equal(state.importRecoveries, 0);
      assert.equal(state.rowStatuses["old-a"], undefined, "the row must not change");
    });
  }

  it("a stale materializing_companies claim is recovered and the decision succeeds", async () => {
    const { state, importOps, reviewOps } = createFakeBatch();
    importOps.claim("materializing_companies");
    state.nowMs += STALE_IMPORT_TO_DRAFT_MS;

    await reviewOps.decide("old-a", "excluded");

    assert.equal(state.importRecoveries, 1);
    assert.equal(state.phase, null);
    assert.equal(state.rowStatuses["old-a"], "excluded");
  });

  it("a stale importing_to_draft claim with partial draft links is recovered and the decision succeeds", async () => {
    const { state, importOps, reviewOps } = createFakeBatch();
    state.draftLinks = 1;
    importOps.claim("importing_to_draft");
    state.nowMs += STALE_IMPORT_TO_DRAFT_MS;

    await reviewOps.decide("old-b", "excluded");

    assert.equal(state.importRecoveries, 1);
    assert.equal(state.phase, null);
    assert.equal(state.rowStatuses["old-b"], "excluded");
  });

  it("a stale materializing_companies claim is not recovered once draft links exist", async () => {
    const { state, importOps, reviewOps } = createFakeBatch();
    state.draftLinks = 1;
    const importToken = importOps.claim("materializing_companies");
    state.nowMs += STALE_IMPORT_TO_DRAFT_MS;

    await assertConflict(reviewOps.decide("old-a", "excluded"), IMPORT_IN_PROGRESS_REVIEW_MESSAGE);

    assert.equal(state.phase, "materializing_companies");
    assert.equal(state.updatedAt, importToken);
    assert.equal(state.importRecoveries, 0);
  });

  it("does not clear a claim that a resumed chunk refreshed after it was judged stale", async () => {
    const { state, hooks, importOps, reviewOps } = createFakeBatch();
    importOps.claim("materializing_companies");
    state.nowMs += STALE_IMPORT_TO_DRAFT_MS;
    const live: { token: string | null } = { token: null };
    hooks.beforeImportRecoveryClear = () => {
      importOps.touch("materializing_companies");
      live.token = state.updatedAt;
    };

    await assertConflict(reviewOps.decide("old-a", "excluded"), IMPORT_IN_PROGRESS_REVIEW_MESSAGE);

    assert.equal(state.phase, "materializing_companies", "the live chunk's claim must survive");
    assert.equal(state.updatedAt, live.token);
    assert.equal(state.importRecoveries, 0);
    assert.equal(state.rowStatuses["old-a"], undefined);
  });

  for (const [phase, message] of [
    ["matching", MATCHING_IN_PROGRESS_MUTATION_MESSAGE],
    ["parsing", MAPPING_IN_PROGRESS_REVIEW_MESSAGE],
    ["validating", VALIDATION_IN_PROGRESS_REVIEW_MESSAGE],
  ] as const) {
    it(`never recovers an old ${phase} claim from a Review decision`, async () => {
      const { state, reviewOps } = createFakeBatch();
      state.phase = phase;
      const otherToken = state.updatedAt;
      state.nowMs += 2 * STALE_VALIDATING_CLAIM_MS;

      await assertConflict(reviewOps.decide("old-a", "excluded"), message);

      assert.equal(state.phase, phase);
      assert.equal(state.updatedAt, otherToken);
      assert.equal(state.importRecoveries, 0);
    });
  }

  it("a failed import can be corrected once its claim is stale, then retried to draft", async () => {
    const { state, importOps, reviewOps } = createFakeBatch();
    // The first attempt claims, then a chunk fails on old-b and leaves the claim behind.
    importOps.claim("materializing_companies");

    await assertConflict(reviewOps.decide("old-b", "excluded"), IMPORT_IN_PROGRESS_REVIEW_MESSAGE);
    assert.equal(state.rowStatuses["old-b"], undefined);

    state.nowMs += STALE_IMPORT_TO_DRAFT_MS;
    await reviewOps.decide("old-b", "excluded");
    assert.equal(state.rowStatuses["old-b"], "excluded", "the reviewer can fix the failing row");
    assert.equal(state.phase, null);

    assert.notEqual(importOps.claim("materializing_companies"), null, "the retry can claim");
    importOps.release("materializing_companies");
    assert.notEqual(importOps.claim("importing_to_draft"), null);
    importOps.release("importing_to_draft");
    assert.equal(importOps.finalize(), true);
    assert.equal(state.status, "draft");
  });
});

describe("mapping and validation overlap", () => {
  it("validation started during a mapping save is rejected, and the mapping finishes and releases", async () => {
    const { state, hooks, mappingDeps, validationDeps } = createFakeBatch();
    const outcome: { validationError: unknown; phaseAfterValidation: string | null } = {
      validationError: null,
      phaseAfterValidation: null,
    };
    hooks.duringInsert = async () => {
      outcome.validationError = await captureError(() => runBatchValidationWithDeps(validationDeps));
      outcome.phaseAfterValidation = state.phase;
    };

    await saveColumnMappingWithDeps(mappingDeps);

    assertConflictError(outcome.validationError, COLUMN_MAPPING_IN_PROGRESS_MESSAGE);
    assert.equal(outcome.phaseAfterValidation, "parsing", "validation must not release the mapping claim");
    assert.deepEqual(state.validatedRows, []);
    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, ["column_mapping_saved"]);

    await runBatchValidationWithDeps(validationDeps);
    assert.deepEqual(state.validatedRows, ["new-a", "new-b", "new-c"]);
    assert.deepEqual(state.actions, ["column_mapping_saved", "validation_run"]);
  });

  it("a mapping save started during validation is rejected, and the validation finishes and releases", async () => {
    const { state, hooks, mappingDeps, validationDeps } = createFakeBatch();
    const outcome: { mappingError: unknown; phaseAfterMapping: string | null } = {
      mappingError: null,
      phaseAfterMapping: null,
    };
    hooks.duringValidationRowUpdate = async () => {
      if (outcome.mappingError !== null) return;
      outcome.mappingError = await captureError(() => saveColumnMappingWithDeps(mappingDeps));
      outcome.phaseAfterMapping = state.phase;
    };

    await runBatchValidationWithDeps(validationDeps);

    assertConflictError(outcome.mappingError, VALIDATION_IN_PROGRESS_MESSAGE);
    assert.equal(outcome.phaseAfterMapping, "validating", "mapping must not overwrite the validating claim");
    assert.equal(state.downloads, 0);
    assert.deepEqual(state.rows, ["old-a", "old-b"]);
    assert.equal(state.phase, null);

    await saveColumnMappingWithDeps(mappingDeps);
    assert.deepEqual(state.rows, ["new-a", "new-b", "new-c"]);
    assert.deepEqual(state.actions, ["validation_run", "column_mapping_saved"]);
  });
});

describe("company matching while a mapping save holds parsing", () => {
  it("cannot claim the batch, so it never matches rows that are being replaced", async () => {
    const { state, hooks, mappingDeps, matchingDeps } = createFakeBatch();
    const matching: { error: unknown } = { error: null };
    hooks.duringInsert = async () => {
      matching.error = await captureError(() => runBatchMatchingWithDeps({ force: true }, matchingDeps));
    };

    await saveColumnMappingWithDeps(mappingDeps);

    assert.ok(matching.error instanceof SponsorImportHttpError, "matching must be rejected");
    assert.equal(matching.error.status, 409);
    assert.equal(state.matchingClaims, 0);
    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, ["column_mapping_saved"]);
  });

  it("still cannot claim after a validation attempt during the mapping save", async () => {
    const { state, hooks, mappingDeps, validationDeps, matchingDeps } = createFakeBatch();
    const outcome: { validationError: unknown; matchingError: unknown } = {
      validationError: null,
      matchingError: null,
    };
    hooks.duringInsert = async () => {
      outcome.validationError = await captureError(() => runBatchValidationWithDeps(validationDeps));
      outcome.matchingError = await captureError(() =>
        runBatchMatchingWithDeps({ force: true }, matchingDeps),
      );
    };

    await saveColumnMappingWithDeps(mappingDeps);

    assertConflictError(outcome.validationError, COLUMN_MAPPING_IN_PROGRESS_MESSAGE);
    assert.ok(outcome.matchingError instanceof SponsorImportHttpError, "matching must be rejected");
    assert.equal(outcome.matchingError.status, 409);
    assert.equal(state.matchingClaims, 0);
  });

  it("can claim once the mapping save has released parsing", async () => {
    const { state, mappingDeps, matchingDeps } = createFakeBatch();

    await saveColumnMappingWithDeps(mappingDeps);
    await runBatchMatchingWithDeps({}, matchingDeps);

    assert.equal(state.matchingClaims, 1);
    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, ["column_mapping_saved", "matching_run"]);
  });

  it("cannot start, normal or forced, while validation holds the batch", async () => {
    const { state, hooks, validationDeps, matchingDeps } = createFakeBatch();
    const outcome: { error: unknown } = { error: null };
    hooks.duringValidationRowUpdate = async () => {
      if (outcome.error !== null) return;
      outcome.error = await captureError(() => runBatchMatchingWithDeps({ force: true }, matchingDeps));
    };

    await runBatchValidationWithDeps(validationDeps);

    assert.ok(outcome.error instanceof SponsorImportHttpError, "forced matching must be rejected");
    assert.equal(outcome.error.status, 409);
    assert.equal(state.matchingClaims, 0);
  });
});

describe("assertImportToDraftNotBlockedByProcessingPhase", () => {
  for (const phase of ["matching", "validating", "parsing", "materializing_companies", "importing_to_draft"]) {
    it(`rejects finalisation while ${phase} holds the batch`, () => {
      assert.throws(
        () => assertImportToDraftNotBlockedByProcessingPhase({ processing_phase: phase }),
        (error: unknown) => {
          assert.ok(error instanceof SponsorImportHttpError, "expected a SponsorImportHttpError");
          assert.equal(error.status, 409);
          return true;
        },
      );
    });
  }

  it("allows finalisation of an idle batch", () => {
    assert.doesNotThrow(() => assertImportToDraftNotBlockedByProcessingPhase({ processing_phase: null }));
  });
});

describe("validation and import-to-draft", () => {
  it("finalisation during validation is rejected, and validation finishes normally", async () => {
    const { state, hooks, validationDeps, importOps } = createFakeBatch();
    const outcome: { error: unknown } = { error: null };
    hooks.duringValidationRowUpdate = () => {
      if (outcome.error !== null) return;
      try {
        importOps.finalize();
      } catch (error) {
        outcome.error = error;
      }
    };

    await runBatchValidationWithDeps(validationDeps);

    assert.ok(outcome.error instanceof SponsorImportHttpError, "finalisation must be rejected");
    assert.equal(outcome.error.status, 409);
    assert.equal(state.status, "review");
    assert.equal(state.phase, null);
  });

  it("a finalisation that passed its guard before validation claimed cannot complete", async () => {
    const { state, hooks, validationDeps, importOps } = createFakeBatch();
    const outcome: { finalized: boolean | null } = { finalized: null };
    hooks.duringValidationRowUpdate = () => {
      if (outcome.finalized !== null) return;
      outcome.finalized = importOps.finalizeUpdate();
    };

    await runBatchValidationWithDeps(validationDeps);

    assert.equal(outcome.finalized, false, "the conditional finalize update must not match");
    assert.equal(state.status, "review");
    assert.equal(state.phase, null);
  });

  it("validation never moves a finalized draft batch back to review", async () => {
    const { state, hooks, validationDeps } = createFakeBatch();
    hooks.duringValidationRowUpdate = () => {
      // A finalisation that cleared the claim (as before the conditional update) wins mid-run.
      state.status = "draft";
      state.phase = null;
      state.updatedAt = new Date(START_MS + 60_000).toISOString();
    };

    await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_SUPERSEDED_MESSAGE);

    assert.equal(state.status, "draft");
    assert.equal(state.phase, null);
    assert.deepEqual(state.actions, []);
  });

  it("validation requested just after finalisation cannot claim the draft batch", async () => {
    const { state, validationDeps, importOps } = createFakeBatch();
    assert.equal(importOps.finalize(), true);
    const draftToken = state.updatedAt;

    await assertConflict(
      runBatchValidationWithDeps(validationDeps),
      "Validation cannot run because this import is already draft.",
    );

    assert.equal(state.status, "draft", "validation must not revert the draft batch to review");
    assert.equal(state.phase, null);
    assert.equal(state.updatedAt, draftToken);
    assert.deepEqual(state.validatedRows, []);
    assert.deepEqual(state.actions, []);
  });

  for (const phase of [null, "validating"]) {
    it(`validation cannot claim a draft batch whose phase is ${phase ?? "empty"}`, async () => {
      const { state, validationDeps } = createFakeBatch();
      state.status = "draft";
      state.phase = phase;
      const token = state.updatedAt;

      await assertConflict(
        runBatchValidationWithDeps(validationDeps),
        "Validation cannot run because this import is already draft.",
      );

      assert.equal(state.status, "draft");
      assert.equal(state.phase, phase);
      assert.equal(state.updatedAt, token);
      assert.deepEqual(state.validatedRows, []);
    });
  }

  it("validation cannot finish against a batch that has become draft", async () => {
    const { state, hooks, validationDeps } = createFakeBatch();
    hooks.duringValidationRowUpdate = () => {
      // Only the status changes: the validating phase and this run's token are still in place.
      state.status = "draft";
    };

    await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_SUPERSEDED_MESSAGE);

    assert.equal(state.status, "draft", "finishing must not move the batch to review");
    assert.deepEqual(state.actions, [], "no validation_run may be logged");
  });

  for (const initialStatus of ["uploaded", "review"]) {
    it(`a ${initialStatus} batch still validates, moves to review, and logs validation_run`, async () => {
      const { state, validationDeps } = createFakeBatch();
      state.status = initialStatus;

      assert.deepEqual(await runBatchValidationWithDeps(validationDeps), { validated_count: 2 });

      assert.equal(state.status, "review");
      assert.equal(state.phase, null);
      assert.deepEqual(state.validatedRows, ["old-a", "old-b"]);
      assert.deepEqual(state.actions, ["validation_run"]);
    });
  }

  it("finalisation succeeds once validation has released", async () => {
    const { state, validationDeps, importOps } = createFakeBatch();

    await runBatchValidationWithDeps(validationDeps);

    assert.equal(importOps.finalize(), true);
    assert.equal(state.status, "draft");
  });

  it("validation after draft links exist is rejected and leaves linked rows' statuses alone", async () => {
    const { state, validationDeps, importOps } = createFakeBatch();
    // A draft-link chunk created links and then failed, so the batch is idle in review again.
    importOps.claim("importing_to_draft");
    state.draftLinks = 2;
    state.rowStatuses = { "old-a": "resolved", "old-b": "excluded" };
    importOps.release("importing_to_draft");

    await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_AFTER_DRAFT_LINKS_MESSAGE);

    assert.deepEqual(state.rowStatuses, { "old-a": "resolved", "old-b": "excluded" });
    assert.deepEqual(state.validatedRows, []);
    assert.equal(state.status, "review");
    assert.equal(state.phase, null, "the validating claim is released");
    assert.equal(state.validationReleaseCalls, 1);
    assert.deepEqual(state.actions, [], "no validation_run may be logged");
    assert.equal(importOps.finalize(), true, "import-to-draft can still be finalized");
  });

  it("validation after draft links exist cannot take over a stale validating claim either", async () => {
    const { state, validationDeps } = createFakeBatch();
    state.draftLinks = 1;
    state.phase = "validating";
    state.updatedAt = dbTimestamp(START_MS - STALE_VALIDATING_CLAIM_MS - 1);

    await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_AFTER_DRAFT_LINKS_MESSAGE);

    assert.deepEqual(state.validatedRows, []);
    assert.equal(state.phase, null);
  });

  it("validation started during an import claim is rejected and leaves the claim intact", async () => {
    const { state, validationDeps, importOps } = createFakeBatch();
    const importToken = importOps.claim("importing_to_draft");

    await assertConflict(runBatchValidationWithDeps(validationDeps), IMPORT_IN_PROGRESS_VALIDATION_MESSAGE);

    assert.equal(state.phase, "importing_to_draft");
    assert.equal(state.updatedAt, importToken);
    importOps.release("importing_to_draft");
    assert.equal(state.phase, null, "the import pipeline can still release its own claim");
  });
});

describe("import pipeline claims against mapping and validation", () => {
  for (const phase of ["materializing_companies", "importing_to_draft"] as const) {
    it(`mapping started during ${phase} is rejected and the import releases normally`, async () => {
      const { state, mappingDeps, importOps } = createFakeBatch();
      const importToken = importOps.claim(phase);

      await assertConflict(saveColumnMappingWithDeps(mappingDeps), IMPORT_IN_PROGRESS_MAPPING_MESSAGE);

      assert.equal(state.updatedAt, importToken);
      assert.deepEqual(state.rows, ["old-a", "old-b"]);
      importOps.release(phase);
      assert.equal(state.phase, null);
    });

    it(`${phase} cannot claim while a mapping save holds parsing`, async () => {
      const { state, hooks, mappingDeps, importOps } = createFakeBatch();
      const outcome: { token: string | null | undefined } = { token: undefined };
      hooks.duringInsert = () => {
        outcome.token = importOps.claim(phase);
      };

      await saveColumnMappingWithDeps(mappingDeps);

      assert.equal(outcome.token, null);
      assert.equal(state.phase, null);
      assert.notEqual(importOps.claim(phase), null, "the import can claim after the mapping releases");
    });

    it(`${phase} cannot claim while validation holds the batch`, async () => {
      const { state, hooks, validationDeps, importOps } = createFakeBatch();
      const outcome: { token: string | null | undefined } = { token: undefined };
      hooks.duringValidationRowUpdate = () => {
        if (outcome.token !== undefined) return;
        outcome.token = importOps.claim(phase);
      };

      await runBatchValidationWithDeps(validationDeps);

      assert.equal(outcome.token, null);
      assert.equal(state.phase, null);
    });
  }

  it("validation during a materialize claim cannot open a path for mapping", async () => {
    const { state, validationDeps, mappingDeps, importOps } = createFakeBatch();
    importOps.claim("materializing_companies");

    await assertConflict(runBatchValidationWithDeps(validationDeps), IMPORT_IN_PROGRESS_VALIDATION_MESSAGE);
    await assertConflict(saveColumnMappingWithDeps(mappingDeps), IMPORT_IN_PROGRESS_MAPPING_MESSAGE);

    assert.equal(state.phase, "materializing_companies");
    assert.deepEqual(state.rows, ["old-a", "old-b"]);
  });
});

describe("interrupted workflows", () => {
  it("a mapping save killed after deleting rows blocks other workflows, then a retry recovers after the stale threshold", async () => {
    const { state, mappingDeps, validationDeps, matchingDeps } = createFakeBatch();
    state.phase = "parsing";
    state.updatedAt = dbTimestamp(state.nowMs - 1000);
    state.rows = [];

    await assertConflict(saveColumnMappingWithDeps(mappingDeps), COLUMN_MAPPING_IN_PROGRESS_MESSAGE);
    await assertConflict(runBatchValidationWithDeps(validationDeps), COLUMN_MAPPING_IN_PROGRESS_MESSAGE);
    const matchingError = await captureError(() => runBatchMatchingWithDeps({ force: true }, matchingDeps));
    assert.ok(matchingError instanceof SponsorImportHttpError, "matching must be rejected");
    assert.equal(matchingError.status, 409);
    assert.equal(state.matchingClaims, 0);

    state.nowMs += STALE_PARSING_CLAIM_MS;
    await saveColumnMappingWithDeps(mappingDeps);

    assert.deepEqual(state.rows, ["new-a", "new-b", "new-c"]);
    assert.equal(state.phase, null);
    await runBatchValidationWithDeps(validationDeps);
    assert.deepEqual(state.actions, ["column_mapping_saved", "validation_run"]);
  });

  it("a killed validation blocks mapping until stale, while a re-run validation recovers immediately", async () => {
    const { state, mappingDeps, validationDeps } = createFakeBatch();
    state.status = "uploaded";
    state.phase = "validating";
    state.updatedAt = dbTimestamp(state.nowMs - 1000);

    await assertConflict(saveColumnMappingWithDeps(mappingDeps), VALIDATION_IN_PROGRESS_MESSAGE);

    await runBatchValidationWithDeps(validationDeps);
    assert.equal(state.phase, null);
    assert.equal(state.status, "review");
  });

  it("an uploaded batch with a killed validation is unblocked by the next mapping save after the stale threshold", async () => {
    const { state, mappingDeps, validationDeps } = createFakeBatch();
    state.status = "uploaded";
    state.phase = "validating";
    state.updatedAt = dbTimestamp(state.nowMs - 1000);

    await assertConflict(saveColumnMappingWithDeps(mappingDeps), VALIDATION_IN_PROGRESS_MESSAGE);
    state.nowMs += STALE_VALIDATING_CLAIM_MS;
    await saveColumnMappingWithDeps(mappingDeps);

    assert.equal(state.phase, null);
    assert.deepEqual(state.rows, ["new-a", "new-b", "new-c"]);
    await runBatchValidationWithDeps(validationDeps);
    assert.equal(state.status, "review");
  });

  it("a stalled validation that resumes while a mapping takeover is in progress cannot clear the claim or change the status", async () => {
    const { state, hooks, mappingDeps, validationDeps } = createFakeBatch();
    state.status = "uploaded";
    let openGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const mapping: { run: Promise<unknown> | null; settled: boolean; claimToken: string | null } = {
      run: null,
      settled: false,
      claimToken: null,
    };
    hooks.duringValidationRowUpdate = async () => {
      if (mapping.run !== null) return;
      // The validation stalls past the stale threshold; a mapping save takes over and is
      // still holding parsing when the validation resumes.
      state.nowMs += STALE_VALIDATING_CLAIM_MS;
      hooks.duringDownload = async () => {
        mapping.claimToken = state.updatedAt;
        await gate;
      };
      mapping.run = saveColumnMappingWithDeps(mappingDeps).finally(() => {
        mapping.settled = true;
      });
      mapping.run.catch(() => {});
      while (state.downloads === 0 && !mapping.settled) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    };

    await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_SUPERSEDED_MESSAGE);

    assert.equal(state.takeovers, 1, "the mapping save must take over the stale validating claim");
    assert.equal(state.phase, "parsing", "the resumed validation must not clear the mapping claim");
    assert.equal(state.updatedAt, mapping.claimToken, "the mapping claim token must be untouched");
    assert.equal(state.status, "uploaded", "the resumed validation must not move the batch to review");
    assert.deepEqual(state.actions, [], "the resumed validation must not log validation_run");

    openGate();
    await mapping.run;
    assert.equal(state.phase, null);
    assert.equal(state.status, "uploaded");
    assert.deepEqual(state.rows, ["new-a", "new-b", "new-c"]);
    assert.deepEqual(state.actions, ["column_mapping_saved"]);
  });

  it("a stalled validation that resumes after a mapping takeover has finished cannot change the status", async () => {
    const { state, hooks, mappingDeps, validationDeps } = createFakeBatch();
    state.status = "uploaded";
    const outcome: { mapped: boolean } = { mapped: false };
    hooks.duringValidationRowUpdate = async () => {
      if (outcome.mapped) return;
      outcome.mapped = true;
      state.nowMs += STALE_VALIDATING_CLAIM_MS;
      await saveColumnMappingWithDeps(mappingDeps);
    };

    await assertConflict(runBatchValidationWithDeps(validationDeps), VALIDATION_SUPERSEDED_MESSAGE);

    assert.equal(state.takeovers, 1);
    assert.equal(state.phase, null);
    assert.equal(state.status, "uploaded", "the resumed validation must not move the batch to review");
    assert.deepEqual(state.actions, ["column_mapping_saved"]);
    assert.deepEqual(state.rows, ["new-a", "new-b", "new-c"]);
  });
});
