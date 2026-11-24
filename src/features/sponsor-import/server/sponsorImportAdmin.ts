import { DUPLICATE_NAME_IMPORT_STOPPED_MESSAGE } from "@/src/lib/companies/duplicateCompanyName";
import { createAdminClient } from "@/src/lib/supabase/admin";

import type {
  ColumnMapping,
  DraftDiffSummary,
  ImportToDraftResult,
  MaterializeCompaniesChunkResult,
  MaterializeDraftLinksChunkResult,
  ParsedSpreadsheetRow,
  PublishResult,
  RowSummary,
  SponsorImportBatchStatus,
  SponsorImportDecisionType,
} from "../types";
import { appendActionLog } from "./actionLog";
import {
  assertBatchStatus,
  assertImportToDraftGuards,
  assertNoActiveProcessingPhase,
  assertNotMatching,
  isAbandonedImportChunkClaim,
  isStaleImportProcessingPhaseClaim,
  isStaleParsingClaim,
  isStaleValidatingClaim,
  MATCHING_IN_PROGRESS_MUTATION_MESSAGE,
  summarizeRows,
  type BatchRow,
  type ImportRowRecord,
} from "./batchGuards";
import { SponsorImportHttpError } from "./errors";
import {
  CompanyDomainLinkError,
  ensureCompanyDomainFromImportLink,
} from "@/src/lib/companies/linkCompanyDomainFromImport";
import {
  loadMatchContext,
  matchRow,
  AUTO_READY_MATCH_METHODS,
  type MatchableRow,
  type MatchResult,
} from "./matchRows";
import {
  isMatchingHeartbeatDue,
  isMatchingRunCurrent,
  isStaleMatchingClaim,
  MATCHING_INVALIDATING_ACTION_TYPES,
  resolveMatchClaimFailure,
  shouldSkipMatchingBecauseAlreadyComplete,
} from "./matchRunPolicy";
import { materializeCompaniesChunk } from "./materializeCompanies";
import { materializeDraftLinksChunk } from "./materializeDraft";
import {
  detectSourceFormat,
  guessColumnMapping,
  parseWithColumnMapping,
  readSpreadsheetHeaders,
} from "./parseSpreadsheet";
import { SPONSOR_IMPORT_BUCKET, SPONSOR_IMPORT_MAX_ROWS } from "../types";
import { deleteSourceFile, uploadSourceFile } from "./storage";
import { enrichImportRowsWithProposedCompanies } from "./enrichImportRows";
import { assignDuplicateClusters, validateRow } from "./validateRows";
import {
  summarizeImportToDraftFinalizeResult,
  summarizeMaterializeCompaniesChunkResult,
  summarizeMaterializeDraftLinksChunkResult,
  withImportToDraftPipelineLog,
} from "./importToDraftPipelineLog";

const BATCH_SELECT =
  "id, event_edition_id, status, processing_phase, source_filename, source_file_storage_path, source_file_format, source_sheet_name, source_row_count, source_file_checksum, column_mapping, created_by, published_by, discarded_by, review_acknowledged_by, published_at, discarded_at, review_acknowledged_at, discard_reason, created_at, updated_at";

const ROW_SELECT =
  "id, batch_id, excel_row_number, raw_company_name, raw_website, raw_tier_rank, raw_tier_label, normalized_company_name, normalized_website, normalized_domain, proposed_slug, mapped_tier_rank, mapped_tier_label, status, validation_issues, has_blocking_validation, match_method, match_confidence, proposed_company_id, conflict_type, decision_type, decision_source, resolved_company_id, decision_by, decision_at, decision_notes, duplicate_cluster_key, duplicate_role, duplicate_of_row_id, duplicate_resolution, already_on_live_sponsor_id, already_on_live_tier_rank, intended_link_action, draft_link_id, import_error, created_at, updated_at";

export type DuplicateClusterDecisionRow = {
  id: string;
  duplicate_cluster_key: string | null;
};

export type DuplicateClusterDecisionPatch = {
  id: string;
  patch: Record<string, unknown>;
  role: "survivor" | "excluded_sibling";
};

/** The row fields an excluded-sibling patch writes; read beforehand so the write can be undone. */
export const DUPLICATE_SIBLING_PATCH_FIELDS = [
  "status",
  "decision_type",
  "decision_source",
  "resolved_company_id",
  "decision_by",
  "decision_at",
  "decision_notes",
  "duplicate_resolution",
  "updated_at",
] as const;

export function buildDuplicateClusterKeepPatches(params: {
  clusterRows: readonly DuplicateClusterDecisionRow[];
  selectedRowId: string;
  selectedPatch: Record<string, unknown>;
  actorId: string;
  now: string;
}): DuplicateClusterDecisionPatch[] {
  const { clusterRows, selectedRowId, selectedPatch, actorId, now } = params;

  return clusterRows.map((row) => {
    if (row.id === selectedRowId) {
      return {
        id: row.id,
        role: "survivor" as const,
        patch: {
          ...selectedPatch,
          duplicate_resolution: "kept",
        },
      };
    }

    return {
      id: row.id,
      role: "excluded_sibling" as const,
      patch: {
        status: "excluded",
        decision_type: "exclude",
        decision_source: "admin_manual",
        resolved_company_id: null,
        decision_by: actorId,
        decision_at: now,
        decision_notes: null,
        duplicate_resolution: "excluded",
        updated_at: now,
      },
    };
  });
}

function parseColumnMapping(raw: unknown): ColumnMapping {
  if (!raw || typeof raw !== "object") {
    throw new SponsorImportHttpError(400, "column_mapping must be an object.");
  }
  const o = raw as Record<string, unknown>;
  const company_name = typeof o.company_name === "string" ? o.company_name.trim() : "";
  const website = typeof o.website === "string" ? o.website.trim() : "";
  const tier_rank = typeof o.tier_rank === "string" ? o.tier_rank.trim() : "";
  const tier_label = typeof o.tier_label === "string" ? o.tier_label.trim() : "";
  if (!company_name || !website || !tier_rank || !tier_label) {
    throw new SponsorImportHttpError(
      400,
      "column_mapping requires company_name, website, tier_rank, and tier_label.",
    );
  }
  const notes = typeof o.notes === "string" ? o.notes.trim() : undefined;
  return { company_name, website, tier_rank, tier_label, ...(notes ? { notes } : {}) };
}

async function getBatchRow(batchId: string): Promise<BatchRow & Record<string, unknown>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sponsor_import_batches")
    .select(BATCH_SELECT)
    .eq("id", batchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new SponsorImportHttpError(404, "Batch not found.");
  return data as BatchRow & Record<string, unknown>;
}

async function loadImportRows(batchId: string): Promise<ImportRowRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sponsor_import_rows")
    .select(
      "id, status, has_blocking_validation, duplicate_cluster_key, duplicate_role, duplicate_resolution",
    )
    .eq("batch_id", batchId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ImportRowRecord[];
}

async function assertEditionExists(editionId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select("id")
    .eq("id", editionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new SponsorImportHttpError(404, "Event edition not found.");
}

export async function listBatchesAdmin(filters: {
  editionId?: string;
  status?: SponsorImportBatchStatus;
  limit?: number;
  offset?: number;
}) {
  const supabase = createAdminClient();
  let query = supabase
    .from("sponsor_import_batches")
    .select(BATCH_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.editionId) query = query.eq("event_edition_id", filters.editionId);
  if (filters.status) query = query.eq("status", filters.status);

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { batches: data ?? [], total: count ?? 0 };
}

export async function getBatchSpreadsheetHeaders(batchId: string): Promise<string[]> {
  const batch = await getBatchRow(batchId);
  const supabase = createAdminClient();
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(SPONSOR_IMPORT_BUCKET)
    .download(batch.source_file_storage_path as string);

  if (downloadError || !fileData) {
    return [];
  }

  const buffer = await fileData.arrayBuffer();
  return readSpreadsheetHeaders(buffer);
}

export async function getBatchAdmin(batchId: string) {
  let batch = await getBatchRow(batchId);
  if (await recoverStaleImportProcessingPhase(batchId, batch)) {
    batch = await getBatchRow(batchId);
  }
  const [rows, headers] = await Promise.all([
    loadImportRows(batchId),
    getBatchSpreadsheetHeaders(batchId),
  ]);
  const summary = summarizeRows(rows);
  return { batch, summary, headers };
}

export async function getActiveBatchForEdition(editionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sponsor_import_batches")
    .select(BATCH_SELECT)
    .eq("event_edition_id", editionId)
    .in("status", ["uploaded", "review", "draft"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createBatchFromUpload(input: {
  actorId: string;
  eventEditionId: string;
  filename: string;
  mimeType: string;
  fileBytes: Uint8Array;
  columnMapping?: ColumnMapping | null;
}) {
  await assertEditionExists(input.eventEditionId);

  const format = detectSourceFormat(input.filename, input.mimeType);
  const buffer = input.fileBytes.buffer.slice(
    input.fileBytes.byteOffset,
    input.fileBytes.byteOffset + input.fileBytes.byteLength,
  ) as ArrayBuffer;

  let mapping = input.columnMapping;
  if (!mapping) {
    const headers = readSpreadsheetHeaders(buffer);
    mapping = guessColumnMapping(headers);
    if (!mapping) {
      throw new SponsorImportHttpError(400, "Could not infer column mapping; provide column_mapping.");
    }
  }

  const { rows, sheetName } = parseWithColumnMapping(buffer, mapping);
  if (rows.length === 0) {
    throw new SponsorImportHttpError(400, "No data rows found in spreadsheet.");
  }

  const supabase = createAdminClient();
  const batchId = crypto.randomUUID();
  const storagePath = await uploadSourceFile(
    batchId,
    input.filename,
    input.fileBytes,
    input.mimeType || "application/octet-stream",
  );

  const { data: batch, error: batchError } = await supabase
    .from("sponsor_import_batches")
    .insert({
      id: batchId,
      event_edition_id: input.eventEditionId,
      status: "uploaded",
      source_filename: input.filename,
      source_file_storage_path: storagePath,
      source_file_format: format,
      source_sheet_name: sheetName,
      source_row_count: rows.length,
      column_mapping: mapping,
      created_by: input.actorId,
    })
    .select(BATCH_SELECT)
    .single();

  if (batchError) throw new Error(batchError.message);

  const rowInserts = rows.map((r) => ({
    batch_id: batchId,
    excel_row_number: r.excelRowNumber,
    raw_company_name: r.rawCompanyName,
    raw_website: r.rawWebsite,
    raw_tier_rank: r.rawTierRank,
    raw_tier_label: r.rawTierLabel,
    status: "needs_review",
    validation_issues: [],
    has_blocking_validation: false,
  }));

  const { error: rowsError } = await supabase.from("sponsor_import_rows").insert(rowInserts);
  if (rowsError) {
    await supabase.from("sponsor_import_batches").delete().eq("id", batchId);
    throw new Error(rowsError.message);
  }

  await appendActionLog({
    batchId,
    actorId: input.actorId,
    actionType: "upload",
    payload: { row_count: rows.length, filename: input.filename },
    affectedCount: rows.length,
  });

  return { batch, rowCount: rows.length };
}

export const COLUMN_MAPPING_IN_PROGRESS_MESSAGE =
  "Column mapping is already being saved. Wait a moment, then try again.";

export const VALIDATION_IN_PROGRESS_MESSAGE =
  "Validation is in progress. Wait for it to finish, then try again.";

export const IMPORT_IN_PROGRESS_MAPPING_MESSAGE =
  "Import to draft is in progress. Column mapping cannot change until it finishes.";

export const IMPORT_IN_PROGRESS_VALIDATION_MESSAGE =
  "Import to draft is in progress. Validation cannot run until it finishes.";

export const VALIDATION_SUPERSEDED_MESSAGE =
  "Validation was interrupted by another change to this import. Run validation again.";

export const MAPPING_AFTER_DRAFT_LINKS_MESSAGE =
  "Column mapping cannot change after Import to draft has created draft links. Finish Import to draft, or discard this import and upload the file again.";

export const COLUMN_MAPPING_SUPERSEDED_MESSAGE =
  "Column mapping was interrupted by another change to this import. Save the mapping again.";

/** Abandoned claims a mapping save may take over once they are stale. */
export type StaleMappingTakeoverPhase = "parsing" | "validating";

/**
 * While `processing_phase = parsing`, the batch `updated_at` is the claim token, as for
 * matching: only its holder may release the claim, and matching cannot claim the batch.
 */
export type SaveColumnMappingDeps<TBatch> = {
  /** Atomic `processing_phase IS NULL -> parsing`; the claim token, or null if any workflow holds the batch. */
  claimParsingPhase: () => Promise<string | null>;
  readParsingClaim: () => Promise<{ processing_phase: string | null; updated_at: string | null }>;
  /**
   * Atomic takeover of an abandoned `phase` claim still holding `staleToken`, leaving the batch
   * in `parsing`; the new token, or null.
   */
  takeOverStaleClaim: (phase: StaleMappingTakeoverPhase, staleToken: string) => Promise<string | null>;
  /** Read while the claim is held, so no draft-link chunk can add links concurrently. */
  countDraftLinks: () => Promise<number>;
  downloadSourceFile: () => Promise<ArrayBuffer>;
  parseRows: (buffer: ArrayBuffer) => { rows: ParsedSpreadsheetRow[]; sheetName: string | null };
  deleteRows: () => Promise<void>;
  insertRows: (rows: readonly ParsedSpreadsheetRow[]) => Promise<void>;
  /**
   * Only while `token` still holds the claim: saves the mapping and releases the claim in one
   * update. Null if the claim was lost, in which case nothing is written.
   */
  saveMappingAndReleaseClaim: (
    token: string,
    input: { sheetName: string | null; rowCount: number },
  ) => Promise<TBatch | null>;
  /** Releases the claim only while `token` still holds it. */
  releaseParsingClaim: (token: string) => Promise<void>;
  logMappingSaved: (rowCount: number) => Promise<void>;
  now: () => number;
};

async function claimParsingPhaseOrThrow<TBatch>(
  deps: SaveColumnMappingDeps<TBatch>,
): Promise<string> {
  const token = await deps.claimParsingPhase();
  if (token !== null) return token;

  let claim = await deps.readParsingClaim();
  const stalePhase: StaleMappingTakeoverPhase | null = isStaleParsingClaim(claim, deps.now())
    ? "parsing"
    : isStaleValidatingClaim(claim, deps.now())
      ? "validating"
      : null;
  if (stalePhase !== null && claim.updated_at) {
    const takenOverToken = await deps.takeOverStaleClaim(stalePhase, claim.updated_at);
    if (takenOverToken !== null) return takenOverToken;
    // Another request changed the batch first; report what holds it now.
    claim = await deps.readParsingClaim();
  }

  if (claim.processing_phase === "matching") {
    throw new SponsorImportHttpError(409, MATCHING_IN_PROGRESS_MUTATION_MESSAGE, {
      processing_phase: claim.processing_phase,
    });
  }
  if (claim.processing_phase === "parsing") {
    throw new SponsorImportHttpError(409, COLUMN_MAPPING_IN_PROGRESS_MESSAGE, {
      processing_phase: claim.processing_phase,
    });
  }
  if (claim.processing_phase === "validating") {
    throw new SponsorImportHttpError(409, VALIDATION_IN_PROGRESS_MESSAGE, {
      processing_phase: claim.processing_phase,
    });
  }
  if (
    claim.processing_phase === "materializing_companies" ||
    claim.processing_phase === "importing_to_draft"
  ) {
    throw new SponsorImportHttpError(409, IMPORT_IN_PROGRESS_MAPPING_MESSAGE, {
      processing_phase: claim.processing_phase,
    });
  }
  throw new SponsorImportHttpError(
    409,
    "Column mapping could not start. Refresh the page and try again.",
    { processing_phase: claim.processing_phase },
  );
}

export async function saveColumnMappingWithDeps<TBatch>(
  deps: SaveColumnMappingDeps<TBatch>,
): Promise<TBatch> {
  const token = await claimParsingPhaseOrThrow(deps);

  let saved: TBatch;
  let released = false;
  let claimLost = false;
  try {
    // Draft links reference the rows a mapping save would delete.
    if ((await deps.countDraftLinks()) > 0) {
      throw new SponsorImportHttpError(409, MAPPING_AFTER_DRAFT_LINKS_MESSAGE);
    }
    const buffer = await deps.downloadSourceFile();
    const { rows, sheetName } = deps.parseRows(buffer);
    await deps.deleteRows();
    if (rows.length > 0) {
      await deps.insertRows(rows);
    }
    const savedBatch = await deps.saveMappingAndReleaseClaim(token, { sheetName, rowCount: rows.length });
    if (savedBatch === null) {
      // A stale takeover gave the batch to another workflow, which may since have moved it on
      // (e.g. finalized it to draft); this save must not write the mapping or status over it.
      claimLost = true;
      throw new SponsorImportHttpError(409, COLUMN_MAPPING_SUPERSEDED_MESSAGE);
    }
    saved = savedBatch;
    released = true;
    await deps.logMappingSaved(rows.length);
  } catch (error) {
    if (!released && !claimLost) {
      try {
        await deps.releaseParsingClaim(token);
      } catch {
        // Surface the original failure; the claim release error is secondary.
      }
    }
    throw error;
  }

  return saved;
}

export async function saveColumnMapping(
  batchId: string,
  actorId: string,
  mapping: ColumnMapping,
  transitionToReview: boolean,
) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["uploaded", "review"]);
  assertNotMatching(batch);

  const supabase = createAdminClient();
  const nextStatus: SponsorImportBatchStatus = transitionToReview ? "review" : batch.status;

  return saveColumnMappingWithDeps({
    claimParsingPhase: async () => {
      const token = new Date().toISOString();
      const { data, error } = await supabase
        .from("sponsor_import_batches")
        .update({ processing_phase: "parsing", updated_at: token })
        .eq("id", batchId)
        .in("status", ["uploaded", "review"])
        .is("processing_phase", null)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? token : null;
    },
    readParsingClaim: async () => {
      const current = await getBatchRow(batchId);
      return {
        processing_phase: current.processing_phase,
        updated_at: typeof current.updated_at === "string" ? current.updated_at : null,
      };
    },
    takeOverStaleClaim: async (phase, staleToken) => {
      const token = new Date().toISOString();
      const { data, error } = await supabase
        .from("sponsor_import_batches")
        .update({ processing_phase: "parsing", updated_at: token })
        .eq("id", batchId)
        .in("status", ["uploaded", "review"])
        .eq("processing_phase", phase)
        .eq("updated_at", staleToken)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? token : null;
    },
    countDraftLinks: async () => {
      const { count, error } = await supabase
        .from("sponsor_import_draft_links")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    downloadSourceFile: async () => {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(SPONSOR_IMPORT_BUCKET)
        .download(batch.source_file_storage_path as string);
      if (downloadError || !fileData) {
        throw new Error(downloadError?.message ?? "Failed to download source file.");
      }
      return fileData.arrayBuffer();
    },
    parseRows: (buffer) => parseWithColumnMapping(buffer, mapping),
    deleteRows: async () => {
      const { error } = await supabase.from("sponsor_import_rows").delete().eq("batch_id", batchId);
      if (error) throw new Error(error.message);
    },
    insertRows: async (rows) => {
      const { error: insertError } = await supabase.from("sponsor_import_rows").insert(
        rows.map((r) => ({
          batch_id: batchId,
          excel_row_number: r.excelRowNumber,
          raw_company_name: r.rawCompanyName,
          raw_website: r.rawWebsite,
          raw_tier_rank: r.rawTierRank,
          raw_tier_label: r.rawTierLabel,
          status: "needs_review",
          validation_issues: [],
          has_blocking_validation: false,
        })),
      );
      if (insertError) throw new Error(insertError.message);
    },
    saveMappingAndReleaseClaim: async (token, { sheetName, rowCount }) => {
      const { data: released, error: releaseError } = await supabase
        .from("sponsor_import_batches")
        .update({
          column_mapping: mapping,
          source_sheet_name: sheetName,
          source_row_count: rowCount,
          status: nextStatus,
          processing_phase: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", batchId)
        .eq("processing_phase", "parsing")
        .eq("updated_at", token)
        .select(BATCH_SELECT)
        .maybeSingle();
      if (releaseError) throw new Error(releaseError.message);
      return released ?? null;
    },
    releaseParsingClaim: async (token) => {
      const { error } = await supabase
        .from("sponsor_import_batches")
        .update({ processing_phase: null, updated_at: new Date().toISOString() })
        .eq("id", batchId)
        .eq("processing_phase", "parsing")
        .eq("updated_at", token);
      if (error) throw new Error(error.message);
    },
    logMappingSaved: (rowCount) =>
      appendActionLog({
        batchId,
        actorId,
        actionType: "column_mapping_saved",
        payload: { mapping, row_count: rowCount },
        affectedCount: rowCount,
      }),
    now: () => Date.now(),
  });
}

export type ValidationSourceRow = {
  id: string;
  excel_row_number: number;
  raw_company_name: string | null;
  raw_website: string | null;
  raw_tier_rank: number | null;
  raw_tier_label: string | null;
  status: string;
};

const VALIDATION_CLAIMABLE_STATUSES: readonly string[] = ["uploaded", "review"];

export const VALIDATION_AFTER_DRAFT_LINKS_MESSAGE =
  "Validation cannot run after Import to draft has created draft links. Finish Import to draft, then use Exclude from publish in the Draft step.";

/**
 * While `processing_phase = validating`, the batch `updated_at` is the claim token: validation
 * clears only its own claim, never one a later workflow took.
 */
export type RunBatchValidationDeps = {
  /**
   * Atomic claim of an `uploaded`/`review` batch that is idle or held by an earlier validation;
   * the claim token, or null.
   */
  claimValidatingPhase: () => Promise<string | null>;
  readClaimState: () => Promise<{ status: string; processing_phase: string | null }>;
  /** Read while the claim is held, so no draft-link chunk can add links concurrently. */
  countDraftLinks: () => Promise<number>;
  loadRows: () => Promise<ValidationSourceRow[]>;
  /**
   * Only while the row still has the status validation read: false if the row changed (e.g. a
   * reviewer decision) or no longer exists, in which case nothing is written.
   */
  updateRowIfStatusUnchanged: (
    rowId: string,
    readStatus: string,
    patch: Record<string, unknown>,
  ) => Promise<boolean>;
  /**
   * Only while `token` still holds the claim on an `uploaded`/`review` batch: sets status
   * `review` and clears the phase in one update. False otherwise, in which case nothing is written.
   */
  finishValidation: (token: string) => Promise<boolean>;
  /** Clears the phase only while `token` still holds the `validating` claim. */
  releaseValidatingClaim: (token: string) => Promise<void>;
  logValidationRun: (validatedCount: number) => Promise<void>;
};

export async function runBatchValidationWithDeps(
  deps: RunBatchValidationDeps,
): Promise<{ validated_count: number }> {
  const token = await deps.claimValidatingPhase();
  if (token === null) {
    const { status, processing_phase: phase } = await deps.readClaimState();
    if (!VALIDATION_CLAIMABLE_STATUSES.includes(status)) {
      throw new SponsorImportHttpError(
        409,
        `Validation cannot run because this import is already ${status}.`,
        { status, processing_phase: phase },
      );
    }
    if (phase === "matching") {
      throw new SponsorImportHttpError(409, MATCHING_IN_PROGRESS_MUTATION_MESSAGE, {
        processing_phase: phase,
      });
    }
    if (phase === "parsing") {
      throw new SponsorImportHttpError(409, COLUMN_MAPPING_IN_PROGRESS_MESSAGE, {
        processing_phase: phase,
      });
    }
    if (phase === "materializing_companies" || phase === "importing_to_draft") {
      throw new SponsorImportHttpError(409, IMPORT_IN_PROGRESS_VALIDATION_MESSAGE, {
        processing_phase: phase,
      });
    }
    throw new SponsorImportHttpError(
      409,
      "Validation could not start. Refresh the page and try again.",
      { processing_phase: phase },
    );
  }

  let finished = false;
  let claimLost = false;
  try {
    // Revalidating would rewrite the statuses of rows the draft links were built from.
    if ((await deps.countDraftLinks()) > 0) {
      throw new SponsorImportHttpError(409, VALIDATION_AFTER_DRAFT_LINKS_MESSAGE);
    }

    const rawRows = await deps.loadRows();

    const validated = assignDuplicateClusters(
      rawRows.map((r) => {
        const v = validateRow(r);
        return { ...v, id: r.id, excel_row_number: r.excel_row_number, status: r.status };
      }),
    );

    for (const row of validated) {
      const prior = rawRows.find((x) => x.id === row.id);
      const priorStatus = prior ? prior.status : "needs_review";
      const nextStatus =
        row.duplicate_resolution === "excluded" || priorStatus === "excluded"
          ? "excluded"
          : row.has_blocking_validation
            ? "needs_review"
            : priorStatus;

      const updated = await deps.updateRowIfStatusUnchanged(row.id, row.status, {
        normalized_company_name: row.normalized_company_name,
        normalized_website: row.normalized_website,
        normalized_domain: row.normalized_domain,
        proposed_slug: row.proposed_slug,
        mapped_tier_rank: row.mapped_tier_rank,
        mapped_tier_label: row.mapped_tier_label,
        validation_issues: row.validation_issues,
        has_blocking_validation: row.has_blocking_validation,
        duplicate_cluster_key: row.duplicate_cluster_key,
        duplicate_role: row.duplicate_role,
        duplicate_of_row_id: row.duplicate_of_row_id,
        duplicate_resolution: row.duplicate_resolution,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      });
      if (!updated) {
        // Writing `nextStatus` (derived from the stale read) would undo the concurrent change;
        // a re-run reads the current status. The claim is released below if still held.
        throw new SponsorImportHttpError(409, VALIDATION_SUPERSEDED_MESSAGE);
      }
    }

    if (!(await deps.finishValidation(token))) {
      // A newer validation or a mapping save (stale takeover) owns the batch; this run's
      // results may describe replaced rows, so it must not set the status or log a run.
      claimLost = true;
      throw new SponsorImportHttpError(409, VALIDATION_SUPERSEDED_MESSAGE);
    }
    finished = true;
    await deps.logValidationRun(validated.length);
    return { validated_count: validated.length };
  } catch (error) {
    if (!finished && !claimLost) {
      try {
        await deps.releaseValidatingClaim(token);
      } catch {
        // Surface the original failure; the claim release error is secondary.
      }
    }
    throw error;
  }
}

export async function runBatchValidation(batchId: string, actorId: string) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["uploaded", "review"]);
  assertNotMatching(batch);

  const supabase = createAdminClient();

  return runBatchValidationWithDeps({
    claimValidatingPhase: async () => {
      const token = new Date().toISOString();
      // Only an idle batch or an earlier validation may be claimed, so matching, a mapping
      // save, and import claims (materializing_companies, importing_to_draft) are never displaced;
      // a batch finalized to draft since the status check above is never claimed.
      const { data, error } = await supabase
        .from("sponsor_import_batches")
        .update({ processing_phase: "validating", updated_at: token })
        .eq("id", batchId)
        .in("status", ["uploaded", "review"])
        .or("processing_phase.is.null,processing_phase.eq.validating")
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? token : null;
    },
    readClaimState: async () => {
      const current = await getBatchRow(batchId);
      return { status: current.status, processing_phase: current.processing_phase };
    },
    countDraftLinks: async () => {
      const { count, error } = await supabase
        .from("sponsor_import_draft_links")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    loadRows: async () => {
      const { data: rawRows, error } = await supabase
        .from("sponsor_import_rows")
        .select(
          "id, excel_row_number, raw_company_name, raw_website, raw_tier_rank, raw_tier_label, status",
        )
        .eq("batch_id", batchId)
        .order("excel_row_number", { ascending: true });
      if (error) throw new Error(error.message);
      return (rawRows ?? []).map((r) => ({
        id: String(r.id),
        excel_row_number: Number(r.excel_row_number),
        raw_company_name: r.raw_company_name as string | null,
        raw_website: r.raw_website as string | null,
        raw_tier_rank: r.raw_tier_rank as number | null,
        raw_tier_label: r.raw_tier_label as string | null,
        status: String(r.status),
      }));
    },
    updateRowIfStatusUnchanged: async (rowId, readStatus, patch) => {
      const { data, error: rowError } = await supabase
        .from("sponsor_import_rows")
        .update(patch)
        .eq("id", rowId)
        .eq("batch_id", batchId)
        .eq("status", readStatus)
        .select("id");
      if (rowError) throw new Error(rowError.message);
      return (data ?? []).length > 0;
    },
    finishValidation: async (token) => {
      const { data: released, error: releaseError } = await supabase
        .from("sponsor_import_batches")
        .update({ status: "review", processing_phase: null, updated_at: new Date().toISOString() })
        .eq("id", batchId)
        .in("status", ["uploaded", "review"])
        .eq("processing_phase", "validating")
        .eq("updated_at", token)
        .select("id")
        .maybeSingle();
      if (releaseError) throw new Error(releaseError.message);
      return Boolean(released);
    },
    releaseValidatingClaim: async (token) => {
      const { error } = await supabase
        .from("sponsor_import_batches")
        .update({ processing_phase: null, updated_at: new Date().toISOString() })
        .eq("id", batchId)
        .eq("processing_phase", "validating")
        .eq("updated_at", token);
      if (error) throw new Error(error.message);
    },
    logValidationRun: (validatedCount) =>
      appendActionLog({
        batchId,
        actorId,
        actionType: "validation_run",
        affectedCount: validatedCount,
      }),
  });
}

export type RunBatchMatchingOptions = {
  /** When true, rematch even if a completed matching_run already exists. API-only; no Review UI control. */
  force?: boolean;
};

export type MatchingRunResult = { matched_count: number; skipped: boolean };

export type MatchingClaimState = { processing_phase: string | null; updated_at: string | null };

/**
 * While `processing_phase = matching`, the batch `updated_at` is the claim token: only the
 * holder of that exact value may renew (heartbeat) or release the claim.
 */
export type RunBatchMatchingDeps = {
  readMatchingClaim: () => Promise<MatchingClaimState>;
  /** True when the newest matching_run is later than any mapping save or validation run. */
  hasCurrentMatchingRun: () => Promise<boolean>;
  latestMatchingRunAffectedCount: () => Promise<number>;
  /** `payload.claim_token` of the newest matching_run; null for logs written without one. */
  latestMatchingRunClaimToken: () => Promise<string | null>;
  /** Atomic `processing_phase IS NULL -> matching`; the new claim token, or null if another caller won. */
  claimMatchingPhase: () => Promise<string | null>;
  /** Atomic token swap while still `matching`; the new token, or null if `token` no longer holds the claim. */
  renewMatchingClaim: (token: string) => Promise<string | null>;
  /** Atomic `matching -> null` only while `token` still holds the claim; false otherwise. */
  releaseMatchingClaim: (token: string) => Promise<boolean>;
  loadMatchableRows: () => Promise<MatchableRow[]>;
  createMatcher: (rows: readonly MatchableRow[]) => Promise<(row: MatchableRow) => Promise<MatchResult>>;
  /** Conditional on the row still being needs_review/auto_ready; false when 0 rows updated. */
  updateRowIfStillMatchable: (rowId: string, result: MatchResult) => Promise<boolean>;
  appendMatchingRunLog: (input: {
    affectedCount: number;
    claimToken: string;
    recoveredStaleClaim: boolean;
  }) => Promise<void>;
  now: () => number;
};

const MATCHABLE_ROW_STATUSES = ["needs_review", "auto_ready"] as const;

/** Re-evaluations allowed after losing a claim race or releasing a finished run's claim. */
const MAX_MATCHING_DECISION_PASSES = 3;

export const MATCHING_CLAIM_LOST_MESSAGE =
  "Matching was taken over by another request. Refresh the page to see the latest results.";

function matchingClaimConflict(phase: string | null): SponsorImportHttpError {
  if (resolveMatchClaimFailure(phase) === "in_progress") {
    return new SponsorImportHttpError(409, "Matching is already in progress.", {
      processing_phase: phase,
    });
  }
  return new SponsorImportHttpError(
    409,
    "Matching could not start. Refresh the page and try again.",
    { processing_phase: phase },
  );
}

export async function runBatchMatchingWithDeps(
  options: RunBatchMatchingOptions,
  deps: RunBatchMatchingDeps,
): Promise<MatchingRunResult> {
  const force = options.force === true;
  let lastPhase: string | null = null;

  for (let pass = 0; pass < MAX_MATCHING_DECISION_PASSES; pass += 1) {
    const claim = await deps.readMatchingClaim();
    lastPhase = claim.processing_phase;
    // An active claim is checked before matching_run freshness: an older matching_run must
    // not make an in-progress (e.g. forced) rematch look complete.
    if (claim.processing_phase === "matching") {
      const finishedRunToken = await deps.latestMatchingRunClaimToken();
      if (finishedRunToken !== null && (await deps.releaseMatchingClaim(finishedRunToken))) {
        continue;
      }

      if (claim.updated_at && isStaleMatchingClaim(claim, deps.now())) {
        const takenOverToken = await deps.renewMatchingClaim(claim.updated_at);
        if (takenOverToken !== null) {
          // The abandoned run may have rewritten some rows, so rematch even if a
          // matching_run looks current.
          return runClaimedBatchMatching(takenOverToken, true, deps);
        }
        continue;
      }

      throw matchingClaimConflict(claim.processing_phase);
    }

    // Rows are being replaced or revalidated, so even a current matching_run may describe
    // rows that no longer exist.
    if (claim.processing_phase === "parsing") {
      throw new SponsorImportHttpError(409, COLUMN_MAPPING_IN_PROGRESS_MESSAGE, {
        processing_phase: claim.processing_phase,
      });
    }
    if (claim.processing_phase === "validating") {
      throw new SponsorImportHttpError(409, VALIDATION_IN_PROGRESS_MESSAGE, {
        processing_phase: claim.processing_phase,
      });
    }

    if (shouldSkipMatchingBecauseAlreadyComplete(force, await deps.hasCurrentMatchingRun())) {
      return { matched_count: await deps.latestMatchingRunAffectedCount(), skipped: true };
    }

    if (claim.processing_phase !== null) {
      throw matchingClaimConflict(claim.processing_phase);
    }

    const token = await deps.claimMatchingPhase();
    if (token !== null) {
      return runClaimedBatchMatching(token, false, deps);
    }
  }

  throw matchingClaimConflict(lastPhase);
}

async function runClaimedBatchMatching(
  claimToken: string,
  recoveredStaleClaim: boolean,
  deps: RunBatchMatchingDeps,
): Promise<MatchingRunResult> {
  let token = claimToken;
  let claimLost = false;
  let lastHeartbeatAt = deps.now();
  let rowsSinceHeartbeat = 0;

  const renewClaimOrAbort = async () => {
    const renewed = await deps.renewMatchingClaim(token);
    if (renewed === null) {
      claimLost = true;
      throw new SponsorImportHttpError(409, MATCHING_CLAIM_LOST_MESSAGE);
    }
    token = renewed;
    lastHeartbeatAt = deps.now();
    rowsSinceHeartbeat = 0;
  };

  let matched = 0;
  try {
    const rows = await deps.loadMatchableRows();
    const match = await deps.createMatcher(rows);
    await renewClaimOrAbort();

    for (const row of rows) {
      if (row.status === "resolved" || row.status === "excluded") continue;

      if (isMatchingHeartbeatDue(rowsSinceHeartbeat, deps.now() - lastHeartbeatAt)) {
        await renewClaimOrAbort();
      }

      const result = await match(row);
      // The row may have been resolved/excluded by a reviewer since `rows` was read.
      if (await deps.updateRowIfStillMatchable(row.id, result)) {
        matched += 1;
      }
      rowsSinceHeartbeat += 1;
    }

    // Fence, then log the exact token left on the batch: if the release below fails, a later
    // request recognises this run as finished and releases the claim with that token.
    await renewClaimOrAbort();
    await deps.appendMatchingRunLog({ affectedCount: matched, claimToken: token, recoveredStaleClaim });
  } catch (error) {
    // A lost claim belongs to the run that took over; never release it.
    if (!claimLost) {
      try {
        await deps.releaseMatchingClaim(token);
      } catch {
        // Surface the original failure; the claim release error is secondary.
      }
    }
    throw error;
  }

  await deps.releaseMatchingClaim(token);
  return { matched_count: matched, skipped: false };
}

export async function runBatchMatching(
  batchId: string,
  actorId: string,
  options: RunBatchMatchingOptions = {},
): Promise<MatchingRunResult> {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["review"]);

  const supabase = createAdminClient();

  return runBatchMatchingWithDeps(options, {
    readMatchingClaim: async () => {
      const current = await getBatchRow(batchId);
      return {
        processing_phase: current.processing_phase,
        updated_at: typeof current.updated_at === "string" ? current.updated_at : null,
      };
    },
    hasCurrentMatchingRun: async () => {
      const { data, error } = await supabase
        .from("sponsor_import_admin_action_logs")
        .select("action_type")
        .eq("batch_id", batchId)
        .in("action_type", ["matching_run", ...MATCHING_INVALIDATING_ACTION_TYPES])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return isMatchingRunCurrent(typeof data?.action_type === "string" ? data.action_type : null);
    },
    latestMatchingRunAffectedCount: async () => {
      const { data, error } = await supabase
        .from("sponsor_import_admin_action_logs")
        .select("affected_count")
        .eq("batch_id", batchId)
        .eq("action_type", "matching_run")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return typeof data?.affected_count === "number" ? data.affected_count : 0;
    },
    latestMatchingRunClaimToken: async () => {
      const { data, error } = await supabase
        .from("sponsor_import_admin_action_logs")
        .select("payload")
        .eq("batch_id", batchId)
        .eq("action_type", "matching_run")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const claimToken = (data?.payload as { claim_token?: unknown } | null | undefined)?.claim_token;
      return typeof claimToken === "string" ? claimToken : null;
    },
    claimMatchingPhase: async () => {
      const token = new Date().toISOString();
      const { data, error } = await supabase
        .from("sponsor_import_batches")
        .update({ processing_phase: "matching", updated_at: token })
        .eq("id", batchId)
        .eq("status", "review")
        .is("processing_phase", null)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? token : null;
    },
    renewMatchingClaim: async (token) => {
      const nextToken = new Date().toISOString();
      const { data, error } = await supabase
        .from("sponsor_import_batches")
        .update({ updated_at: nextToken })
        .eq("id", batchId)
        .eq("status", "review")
        .eq("processing_phase", "matching")
        .eq("updated_at", token)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? nextToken : null;
    },
    releaseMatchingClaim: async (token) => {
      const { data, error } = await supabase
        .from("sponsor_import_batches")
        .update({ processing_phase: null, updated_at: new Date().toISOString() })
        .eq("id", batchId)
        .eq("status", "review")
        .eq("processing_phase", "matching")
        .eq("updated_at", token)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
    loadMatchableRows: async () => {
      const { data, error } = await supabase
        .from("sponsor_import_rows")
        .select(
          "id, status, normalized_domain, normalized_website, normalized_company_name, mapped_tier_rank, has_blocking_validation",
        )
        .eq("batch_id", batchId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: String(row.id),
        status: String(row.status) as ImportRowRecord["status"],
        normalized_domain: row.normalized_domain as string | null,
        normalized_website: row.normalized_website as string | null,
        normalized_company_name: row.normalized_company_name as string | null,
        mapped_tier_rank: row.mapped_tier_rank as number | null,
        has_blocking_validation: Boolean(row.has_blocking_validation),
      }));
    },
    createMatcher: async (rows) => {
      const { matchContext, liveByCompanyId } = await loadMatchContext(
        String(batch.event_edition_id),
        rows,
      );
      return (row) => matchRow(row, matchContext, liveByCompanyId);
    },
    updateRowIfStillMatchable: async (rowId, result) => {
      const { data, error } = await supabase
        .from("sponsor_import_rows")
        .update({
          status: result.status,
          match_method: result.match_method,
          match_confidence: result.match_confidence,
          proposed_company_id: result.proposed_company_id,
          conflict_type: result.conflict_type,
          already_on_live_sponsor_id: result.already_on_live_sponsor_id,
          already_on_live_tier_rank: result.already_on_live_tier_rank,
          intended_link_action: result.intended_link_action,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowId)
        .eq("batch_id", batchId)
        .in("status", [...MATCHABLE_ROW_STATUSES])
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    appendMatchingRunLog: ({ affectedCount, claimToken, recoveredStaleClaim }) =>
      appendActionLog({
        batchId,
        actorId,
        actionType: "matching_run",
        affectedCount,
        payload: { claim_token: claimToken, recovered_stale_claim: recoveredStaleClaim },
      }),
    now: () => Date.now(),
  });
}

export async function bulkAcceptDomainMatches(batchId: string, actorId: string) {
  await prepareReviewMutation(batchId);

  const supabase = createAdminClient();

  return bulkAcceptDomainMatchesWithDeps(batchId, actorId, {
    fetchAutoReadyRows: async (targetBatchId) => {
      const { data, error } = await supabase
        .from("sponsor_import_rows")
        .select("id, proposed_company_id")
        .eq("batch_id", targetBatchId)
        .eq("status", "auto_ready")
        .eq("match_confidence", "high")
        .in("match_method", [...AUTO_READY_MATCH_METHODS]);

      if (error) throw new Error(error.message);
      return (data ?? []) as BulkAcceptDomainMatchRow[];
    },
    resolveRow: async (rowId, patch) => {
      const { error } = await supabase.from("sponsor_import_rows").update(patch).eq("id", rowId);
      if (error) throw new Error(error.message);
    },
    logAction: async ({ batchId: logBatchId, actorId: logActorId, affectedCount }) => {
      await appendActionLog({
        batchId: logBatchId,
        actorId: logActorId,
        actionType: "bulk_accept_domain_matches",
        affectedCount,
      });
    },
  });
}

export type BulkAcceptDomainMatchRow = {
  id: string;
  proposed_company_id: string | null;
};

export type BulkAcceptDomainMatchPatch = {
  status: "resolved";
  decision_type: "use_matched";
  decision_source: "bulk_action";
  resolved_company_id: string;
  decision_by: string;
  decision_at: string;
  updated_at: string;
};

export type BulkAcceptDomainMatchesDeps = {
  fetchAutoReadyRows: (batchId: string) => Promise<readonly BulkAcceptDomainMatchRow[]>;
  resolveRow: (rowId: string, patch: BulkAcceptDomainMatchPatch) => Promise<void>;
  logAction: (input: {
    batchId: string;
    actorId: string;
    affectedCount: number;
  }) => Promise<void>;
};

export async function bulkAcceptDomainMatchesWithDeps(
  batchId: string,
  actorId: string,
  deps: BulkAcceptDomainMatchesDeps,
): Promise<{ accepted_count: number }> {
  const now = new Date().toISOString();
  const autoRows = await deps.fetchAutoReadyRows(batchId);

  let accepted = 0;
  for (const row of autoRows) {
    const proposed = row.proposed_company_id;
    if (!proposed) continue;

    await deps.resolveRow(row.id, {
      status: "resolved",
      decision_type: "use_matched",
      decision_source: "bulk_action",
      resolved_company_id: proposed,
      decision_by: actorId,
      decision_at: now,
      updated_at: now,
    });
    accepted += 1;
  }

  await deps.logAction({ batchId, actorId, affectedCount: accepted });

  return { accepted_count: accepted };
}

type BulkRowDecisionRow = {
  id: string;
  status: string;
  has_blocking_validation: boolean;
  normalized_company_name: string | null;
  raw_company_name: string | null;
  normalized_website: string | null;
  raw_website: string | null;
  normalized_domain: string | null;
  duplicate_role: string | null;
};

function isServerEligibleForBulkCreateNew(row: BulkRowDecisionRow): boolean {
  if (row.status === "resolved" || row.status === "excluded") return false;
  if (row.has_blocking_validation === true) return false;
  const name = (row.normalized_company_name ?? row.raw_company_name ?? "").trim();
  return name !== "";
}

function isServerEligibleForBulkExclude(row: BulkRowDecisionRow): boolean {
  return row.status !== "resolved" && row.status !== "excluded";
}

export async function bulkApplyRowDecisions(
  batchId: string,
  actorId: string,
  input: {
    decision_type: "create_new" | "exclude";
    row_ids: string[];
  },
) {
  await prepareReviewMutation(batchId);

  const uniqueIds = Array.from(new Set(input.row_ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    throw new SponsorImportHttpError(400, "row_ids must not be empty.");
  }
  if (uniqueIds.length > SPONSOR_IMPORT_MAX_ROWS) {
    throw new SponsorImportHttpError(
      400,
      `Maximum ${SPONSOR_IMPORT_MAX_ROWS} rows per bulk action.`,
    );
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("sponsor_import_rows")
    .select(
      "id, status, has_blocking_validation, normalized_company_name, raw_company_name, normalized_website, raw_website, normalized_domain, duplicate_role",
    )
    .eq("batch_id", batchId)
    .in("id", uniqueIds);

  if (error) throw new Error(error.message);

  const now = new Date().toISOString();
  let applied_count = 0;
  let skipped_count = 0;

  for (const row of (rows ?? []) as BulkRowDecisionRow[]) {
    const rowId = String(row.id);

    if (input.decision_type === "create_new") {
      if (!isServerEligibleForBulkCreateNew(row)) {
        skipped_count += 1;
        continue;
      }

      const patch: Record<string, unknown> = {
        status: "resolved",
        decision_type: "create_new",
        decision_source: "bulk_action",
        resolved_company_id: null,
        decision_by: actorId,
        decision_at: now,
        updated_at: now,
      };
      if (row.duplicate_role === "duplicate") {
        patch.duplicate_resolution = "kept";
      }

      const { error: updateError } = await supabase
        .from("sponsor_import_rows")
        .update(patch)
        .eq("id", rowId);
      if (updateError) throw new Error(updateError.message);
      applied_count += 1;
      continue;
    }

    if (!isServerEligibleForBulkExclude(row)) {
      skipped_count += 1;
      continue;
    }

    const patch: Record<string, unknown> = {
      status: "excluded",
      decision_type: "exclude",
      decision_source: "bulk_action",
      resolved_company_id: null,
      decision_by: actorId,
      decision_at: now,
      updated_at: now,
    };
    if (row.duplicate_role === "duplicate") {
      patch.duplicate_resolution = "excluded";
    }

    const { error: updateError } = await supabase
      .from("sponsor_import_rows")
      .update(patch)
      .eq("id", rowId);
    if (updateError) throw new Error(updateError.message);
    applied_count += 1;
  }

  skipped_count += uniqueIds.length - (rows ?? []).length;

  return { applied_count, skipped_count };
}

export async function listBatchRows(
  batchId: string,
  filters: {
    status?: string;
    hasBlockingValidation?: boolean;
    duplicateResolution?: string;
    duplicateClusterKey?: string;
    page?: number;
    pageSize?: number;
  },
) {
  await getBatchRow(batchId);
  const supabase = createAdminClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("sponsor_import_rows")
    .select(ROW_SELECT, { count: "exact" })
    .eq("batch_id", batchId)
    .order("excel_row_number", { ascending: true });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.hasBlockingValidation !== undefined) {
    query = query.eq("has_blocking_validation", filters.hasBlockingValidation);
  }
  if (filters.duplicateResolution) {
    query = query.eq("duplicate_resolution", filters.duplicateResolution);
  }
  if (filters.duplicateClusterKey) {
    query = query.eq("duplicate_cluster_key", filters.duplicateClusterKey);
  }

  query = query.range(from, to);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const allRows = await loadImportRows(batchId);
  const summary: RowSummary = summarizeRows(allRows);
  const duplicateClusterSizes = new Map<string, number>();
  for (const row of allRows) {
    const key = row.duplicate_cluster_key?.trim() ?? "";
    if (key === "") continue;
    duplicateClusterSizes.set(key, (duplicateClusterSizes.get(key) ?? 0) + 1);
  }
  const rowsWithClusterSizes = (data ?? []).map((row) => {
    const key =
      typeof row.duplicate_cluster_key === "string" ? row.duplicate_cluster_key.trim() : "";
    return {
      ...row,
      duplicate_cluster_size: key === "" ? null : (duplicateClusterSizes.get(key) ?? null),
    };
  });
  const rows = await enrichImportRowsWithProposedCompanies(rowsWithClusterSizes);

  return { rows, total: count ?? 0, page, pageSize, summary };
}

export async function getBatchRowById(batchId: string, rowId: string) {
  await getBatchRow(batchId);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sponsor_import_rows")
    .select(ROW_SELECT)
    .eq("batch_id", batchId)
    .eq("id", rowId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new SponsorImportHttpError(404, "Row not found.");
  const [row] = await enrichImportRowsWithProposedCompanies([data]);
  return row ?? data;
}

async function maybeLinkReviewedImportDomain(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    decision_type: SponsorImportDecisionType;
    resolved_company_id?: string | null;
    proposed_company_id: string | null;
    normalized_domain: string | null;
  },
): Promise<void> {
  let companyId: string | null = null;
  if (input.decision_type === "use_matched") {
    companyId = input.resolved_company_id ?? input.proposed_company_id;
  } else if (input.decision_type === "choose_different") {
    companyId = input.resolved_company_id ?? null;
  }
  if (!companyId) return;

  try {
    await ensureCompanyDomainFromImportLink(supabase, {
      companyId,
      normalizedImportDomain: input.normalized_domain,
    });
  } catch (error) {
    if (error instanceof CompanyDomainLinkError) {
      throw new SponsorImportHttpError(error.status, error.message);
    }
    throw error;
  }
}

export const LINKED_ROW_DECISION_MESSAGE =
  "This row already has a draft link from Import to draft, so its decision can no longer change. Finish Import to draft, then use Exclude from publish in the Draft step.";

export const ROW_DECISION_CONFLICT_MESSAGE =
  "This row changed while your decision was being saved. Refresh the page and try again.";

export type RowDecisionInput = {
  decision_type: SponsorImportDecisionType;
  resolved_company_id?: string | null;
  decision_notes?: string | null;
  duplicate_resolution?: "kept" | "excluded" | "pending" | null;
};

export type RowDecisionTargetRow = {
  id: string;
  proposed_company_id: string | null;
  duplicate_cluster_key: string | null;
  normalized_domain: string | null;
  draft_link_id: string | null;
};

export type RowDecisionClusterRow = DuplicateClusterDecisionRow & {
  draft_link_id: string | null;
  /** The row's `DUPLICATE_SIBLING_PATCH_FIELDS` values when it was read. */
  previous: Record<string, unknown>;
};

/**
 * A row with a draft link is already part of the draft that will be published, and the link is
 * shared per company; changing the row's decision would leave the link describing the old one.
 */
export type PatchRowDecisionDeps<TSaved, TResult> = {
  loadRow: () => Promise<RowDecisionTargetRow | null>;
  loadClusterRows: (clusterKey: string) => Promise<RowDecisionClusterRow[]>;
  linkReviewedDomain: (input: {
    decision_type: SponsorImportDecisionType;
    resolved_company_id?: string | null;
    proposed_company_id: string | null;
    normalized_domain: string | null;
  }) => Promise<void>;
  /** Only while the row still has no draft link; the updated row, or null if nothing matched. */
  updateUnlinkedRow: (rowId: string, patch: Record<string, unknown>) => Promise<TSaved | null>;
  /** Only while the row still has no draft link; false if nothing matched. */
  updateUnlinkedSibling: (rowId: string, patch: Record<string, unknown>) => Promise<boolean>;
  /**
   * Puts back a sibling's `previous` values, only while it still has this request's write
   * (`updated_at = writtenAt`) and no draft link; false if nothing matched.
   */
  restoreSibling: (rowId: string, previous: Record<string, unknown>, writtenAt: string) => Promise<boolean>;
  present: (row: TSaved) => Promise<TResult>;
  now: () => string;
};

function assertNoDraftLinkedRows(rows: ReadonlyArray<{ id: string; draft_link_id: string | null }>): void {
  const linkedRowIds = rows.filter((row) => row.draft_link_id !== null).map((row) => row.id);
  if (linkedRowIds.length > 0) {
    throw new SponsorImportHttpError(409, LINKED_ROW_DECISION_MESSAGE, { linked_row_ids: linkedRowIds });
  }
}

export async function patchRowDecisionWithDeps<TSaved, TResult>(
  rowId: string,
  actorId: string,
  input: RowDecisionInput,
  deps: PatchRowDecisionDeps<TSaved, TResult>,
): Promise<TResult> {
  const row = await deps.loadRow();
  if (!row) throw new SponsorImportHttpError(404, "Row not found.");
  assertNoDraftLinkedRows([row]);

  const now = deps.now();
  const patch: Record<string, unknown> = {
    decision_type: input.decision_type,
    decision_source: "admin_manual",
    decision_by: actorId,
    decision_at: now,
    decision_notes: input.decision_notes ?? null,
    updated_at: now,
  };

  if (input.duplicate_resolution !== undefined) {
    patch.duplicate_resolution = input.duplicate_resolution;
  }

  if (input.decision_type === "exclude") {
    patch.status = "excluded";
    patch.resolved_company_id = null;
  } else if (input.decision_type === "use_matched") {
    const companyId = input.resolved_company_id ?? row.proposed_company_id;
    if (!companyId) {
      throw new SponsorImportHttpError(400, "No proposed company to use.");
    }
    patch.status = "resolved";
    patch.resolved_company_id = companyId;
  } else if (input.decision_type === "choose_different") {
    if (!input.resolved_company_id) {
      throw new SponsorImportHttpError(400, "resolved_company_id required.");
    }
    patch.status = "resolved";
    patch.resolved_company_id = input.resolved_company_id;
  } else if (input.decision_type === "create_new") {
    patch.status = "resolved";
    patch.resolved_company_id = null;
  }

  const duplicateClusterKey = row.duplicate_cluster_key?.trim() ?? "";
  const resolvesDuplicateCluster =
    duplicateClusterKey !== "" &&
    input.duplicate_resolution === "kept" &&
    input.decision_type !== "exclude";

  // Every row the decision would write is checked before anything (including the company
  // domain link) is written.
  const clusterRows = resolvesDuplicateCluster ? await deps.loadClusterRows(duplicateClusterKey) : [];
  assertNoDraftLinkedRows(clusterRows);

  await deps.linkReviewedDomain({
    decision_type: input.decision_type,
    resolved_company_id: input.resolved_company_id,
    proposed_company_id: row.proposed_company_id,
    normalized_domain: row.normalized_domain,
  });

  if (resolvesDuplicateCluster) {
    const patches = buildDuplicateClusterKeepPatches({
      clusterRows,
      selectedRowId: rowId,
      selectedPatch: patch,
      actorId,
      now,
    });
    const survivor = patches.find((item) => item.role === "survivor");
    if (!survivor) {
      throw new SponsorImportHttpError(404, "Selected duplicate row not found.");
    }

    // Siblings first and the survivor last, so a failure never leaves a kept row beside
    // siblings that were not excluded; siblings already excluded are then put back.
    const excludedSiblings: RowDecisionClusterRow[] = [];
    let updatedSelected: TSaved;
    try {
      for (const item of patches) {
        if (item.role !== "excluded_sibling") continue;
        if (!(await deps.updateUnlinkedSibling(item.id, item.patch))) {
          throw new SponsorImportHttpError(409, ROW_DECISION_CONFLICT_MESSAGE, { row_id: item.id });
        }
        excludedSiblings.push(clusterRows.find((clusterRow) => clusterRow.id === item.id)!);
      }
      const saved = await deps.updateUnlinkedRow(survivor.id, survivor.patch);
      if (saved === null) {
        throw new SponsorImportHttpError(409, ROW_DECISION_CONFLICT_MESSAGE, { row_id: survivor.id });
      }
      updatedSelected = saved;
    } catch (error) {
      for (const sibling of excludedSiblings.reverse()) {
        try {
          if (!(await deps.restoreSibling(sibling.id, sibling.previous, now))) {
            console.error(`[sponsor-import] duplicate sibling ${sibling.id} changed before it could be restored`);
          }
        } catch (restoreError) {
          console.error(`[sponsor-import] failed to restore duplicate sibling ${sibling.id}:`, restoreError);
        }
      }
      throw error;
    }
    return deps.present(updatedSelected);
  }

  const updated = await deps.updateUnlinkedRow(rowId, patch);
  if (updated === null) {
    throw new SponsorImportHttpError(409, ROW_DECISION_CONFLICT_MESSAGE, { row_id: rowId });
  }
  return deps.present(updated);
}

export async function patchRowDecision(
  batchId: string,
  rowId: string,
  actorId: string,
  input: RowDecisionInput,
) {
  await prepareReviewMutation(batchId);

  const supabase = createAdminClient();
  return patchRowDecisionWithDeps(rowId, actorId, input, {
    loadRow: async () => {
      const { data, error } = await supabase
        .from("sponsor_import_rows")
        .select("id, proposed_company_id, duplicate_cluster_key, normalized_domain, draft_link_id")
        .eq("batch_id", batchId)
        .eq("id", rowId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: String(data.id),
        proposed_company_id: typeof data.proposed_company_id === "string" ? data.proposed_company_id : null,
        duplicate_cluster_key: typeof data.duplicate_cluster_key === "string" ? data.duplicate_cluster_key : null,
        normalized_domain: typeof data.normalized_domain === "string" ? data.normalized_domain : null,
        draft_link_id: typeof data.draft_link_id === "string" ? data.draft_link_id : null,
      };
    },
    loadClusterRows: async (clusterKey) => {
      const { data, error } = await supabase
        .from("sponsor_import_rows")
        .select(`id, duplicate_cluster_key, draft_link_id, ${DUPLICATE_SIBLING_PATCH_FIELDS.join(", ")}`)
        .eq("batch_id", batchId)
        .eq("duplicate_cluster_key", clusterKey);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((clusterRow) => ({
        id: String(clusterRow.id),
        duplicate_cluster_key:
          typeof clusterRow.duplicate_cluster_key === "string" ? clusterRow.duplicate_cluster_key : null,
        draft_link_id: typeof clusterRow.draft_link_id === "string" ? clusterRow.draft_link_id : null,
        previous: Object.fromEntries(DUPLICATE_SIBLING_PATCH_FIELDS.map((field) => [field, clusterRow[field] ?? null])),
      }));
    },
    linkReviewedDomain: (linkInput) => maybeLinkReviewedImportDomain(supabase, linkInput),
    updateUnlinkedRow: async (targetRowId, patch) => {
      const { data, error } = await supabase
        .from("sponsor_import_rows")
        .update(patch)
        .eq("id", targetRowId)
        .eq("batch_id", batchId)
        .is("draft_link_id", null)
        .select(ROW_SELECT)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
    updateUnlinkedSibling: async (targetRowId, patch) => {
      const { data, error } = await supabase
        .from("sponsor_import_rows")
        .update(patch)
        .eq("id", targetRowId)
        .eq("batch_id", batchId)
        .is("draft_link_id", null)
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    restoreSibling: async (targetRowId, previous, writtenAt) => {
      const { data, error } = await supabase
        .from("sponsor_import_rows")
        .update(previous)
        .eq("id", targetRowId)
        .eq("batch_id", batchId)
        .eq("updated_at", writtenAt)
        .is("draft_link_id", null)
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    present: async (saved) => {
      const [enrichedRow] = await enrichImportRowsWithProposedCompanies([saved]);
      return enrichedRow ?? saved;
    },
    now: () => new Date().toISOString(),
  });
}

function parseImportToDraftResultPayload(payload: unknown): ImportToDraftResult | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (
    typeof p.companies_created !== "number" ||
    typeof p.draft_links_created !== "number" ||
    typeof p.draft_links_updated !== "number" ||
    typeof p.rows_materialized !== "number"
  ) {
    return null;
  }
  return {
    companies_created: p.companies_created,
    draft_links_created: p.draft_links_created,
    draft_links_updated: p.draft_links_updated,
    rows_materialized: p.rows_materialized,
  };
}

async function loadImportToDraftResultFromLog(
  batchId: string,
): Promise<ImportToDraftResult | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sponsor_import_admin_action_logs")
    .select("payload")
    .eq("batch_id", batchId)
    .eq("action_type", "import_to_draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return parseImportToDraftResultPayload(data?.payload);
}

async function countCompaniesCreatedFromImportLogs(batchId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sponsor_import_admin_action_logs")
    .select("payload")
    .eq("batch_id", batchId)
    .eq("action_type", "materialize_companies_chunk");

  if (error) throw new Error(error.message);

  let total = 0;
  for (const row of data ?? []) {
    const payload = row.payload as Record<string, unknown> | null;
    if (payload && typeof payload.companies_created === "number") {
      total += payload.companies_created;
    }
  }
  return total;
}

async function summarizeImportToDraftFromDb(batchId: string): Promise<ImportToDraftResult> {
  const supabase = createAdminClient();
  const { count: linkCount, error: linkError } = await supabase
    .from("sponsor_import_draft_links")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);
  if (linkError) throw new Error(linkError.message);

  const { count: rowsMaterialized, error: rowError } = await supabase
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .not("draft_link_id", "is", null);
  if (rowError) throw new Error(rowError.message);

  return {
    companies_created: await countCompaniesCreatedFromImportLogs(batchId),
    draft_links_created: linkCount ?? 0,
    draft_links_updated: 0,
    rows_materialized: rowsMaterialized ?? 0,
  };
}

async function resolveIdempotentImportToDraftResult(
  batchId: string,
): Promise<ImportToDraftResult> {
  return (await loadImportToDraftResultFromLog(batchId)) ?? summarizeImportToDraftFromDb(batchId);
}

export type RecoverStaleImportProcessingPhaseDeps = {
  countDraftLinks: () => Promise<number>;
  /**
   * Atomic `phase -> null` only while the batch is still in review, in `phase`, and still has
   * the `updated_at` that was judged stale; false otherwise.
   */
  clearStaleClaim: (phase: string, staleUpdatedAt: string | null) => Promise<boolean>;
  now: () => number;
};

export async function recoverStaleImportProcessingPhaseWithDeps(
  batch: Pick<BatchRow, "processing_phase" | "status" | "updated_at">,
  deps: RecoverStaleImportProcessingPhaseDeps,
): Promise<boolean> {
  if (!isStaleImportProcessingPhaseClaim(batch, deps.now())) {
    return false;
  }

  const phase = batch.processing_phase;

  // Company materialization should not leave draft links behind; if any exist,
  // do not auto-clear a stale materializing_companies claim.
  if (phase === "materializing_companies" && (await deps.countDraftLinks()) > 0) {
    return false;
  }

  // importing_to_draft may legitimately have partial draft links after a timeout;
  // allow stale recovery so chunked draft-link materialization can resume.
  if (!phase) {
    return false;
  }

  // A chunk that re-claimed or touched the batch since it was read is live; leave it alone.
  return deps.clearStaleClaim(phase, batch.updated_at ?? null);
}

/** Clear orphaned import processing when a prior attempt died mid-flight (e.g. serverless timeout). */
async function recoverStaleImportProcessingPhase(
  batchId: string,
  batch: BatchRow,
): Promise<boolean> {
  const supabase = createAdminClient();

  return recoverStaleImportProcessingPhaseWithDeps(batch, {
    countDraftLinks: async () => {
      const { count, error } = await supabase
        .from("sponsor_import_draft_links")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    clearStaleClaim: async (phase, staleUpdatedAt) => {
      let query = supabase
        .from("sponsor_import_batches")
        .update({ processing_phase: null, updated_at: new Date().toISOString() })
        .eq("id", batchId)
        .eq("status", "review")
        .eq("processing_phase", phase);
      query = staleUpdatedAt === null ? query.is("updated_at", null) : query.eq("updated_at", staleUpdatedAt);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
    now: () => Date.now(),
  });
}

export const IMPORT_CHUNK_IN_PROGRESS_MESSAGE =
  "Another request is already running this import step. Wait a few minutes, then try again.";

export const IMPORT_CHUNK_CLAIM_LOST_MESSAGE =
  "This import step was taken over by another request. Refresh the page and try again.";

type ImportChunkPhase = "materializing_companies" | "importing_to_draft";

/**
 * While an import step holds `processing_phase`, the batch `updated_at` is its claim token:
 * the request that wrote it returns it to the client, which presents it with the next chunk.
 */
export type AcquireImportChunkClaimDeps = {
  readBatch: () => Promise<BatchRow>;
  /** Atomic `processing_phase IS NULL -> phase` on a review batch; the new token, or null. */
  claimFromIdle: () => Promise<string | null>;
  /** Atomic refresh only while `token` still holds the `phase` claim; the new token, or null. */
  continueClaim: (token: string) => Promise<string | null>;
  /**
   * Atomic takeover of an abandoned `phase` claim only while it still has the `updated_at`
   * that was judged abandoned; the new token, or null.
   */
  takeOverClaim: (abandonedUpdatedAt: string | null) => Promise<string | null>;
  now: () => number;
};

/**
 * A chunk may process rows only after this succeeds, and then it alone owns the step until its
 * token is presented again or the claim is abandoned. A request without the current token (a
 * second tab, a page reload, a retry after a lost response) is rejected while a chunk could still
 * be running. When another workflow holds the batch, its state is returned for the caller's
 * phase-specific response.
 */
export async function acquireImportChunkClaimWithDeps(
  phase: ImportChunkPhase,
  batch: BatchRow,
  presentedToken: string | null,
  deps: AcquireImportChunkClaimDeps,
): Promise<{ acquired: true; token: string } | { acquired: false; batch: BatchRow }> {
  if (presentedToken !== null) {
    const token = await deps.continueClaim(presentedToken);
    if (token !== null) return { acquired: true, token };
  }

  let current = batch;
  if (current.processing_phase !== phase) {
    const token = await deps.claimFromIdle();
    if (token !== null) return { acquired: true, token };
    current = await deps.readBatch();
    if (current.processing_phase !== phase) return { acquired: false, batch: current };
  }

  if (isAbandonedImportChunkClaim(current, deps.now())) {
    const token = await deps.takeOverClaim(current.updated_at ?? null);
    if (token !== null) return { acquired: true, token };
  }
  throw new SponsorImportHttpError(
    409,
    presentedToken !== null ? IMPORT_CHUNK_CLAIM_LOST_MESSAGE : IMPORT_CHUNK_IN_PROGRESS_MESSAGE,
    { processing_phase: phase },
  );
}

function acquireImportChunkClaim(
  batchId: string,
  phase: ImportChunkPhase,
  batch: BatchRow,
  presentedToken: string | null,
): ReturnType<typeof acquireImportChunkClaimWithDeps> {
  const supabase = createAdminClient();
  return acquireImportChunkClaimWithDeps(phase, batch, presentedToken, {
    readBatch: () => getBatchRow(batchId),
    claimFromIdle: async () => {
      const token = new Date().toISOString();
      const { data, error } = await supabase
        .from("sponsor_import_batches")
        .update({ processing_phase: phase, updated_at: token })
        .eq("id", batchId)
        .eq("status", "review")
        .is("processing_phase", null)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? token : null;
    },
    continueClaim: async (heldToken) => {
      const token = new Date().toISOString();
      const { data, error } = await supabase
        .from("sponsor_import_batches")
        .update({ updated_at: token })
        .eq("id", batchId)
        .eq("status", "review")
        .eq("processing_phase", phase)
        .eq("updated_at", heldToken)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? token : null;
    },
    takeOverClaim: async (abandonedUpdatedAt) => {
      const token = new Date().toISOString();
      let query = supabase
        .from("sponsor_import_batches")
        .update({ updated_at: token })
        .eq("id", batchId)
        .eq("status", "review")
        .eq("processing_phase", phase);
      query =
        abandonedUpdatedAt === null
          ? query.is("updated_at", null)
          : query.eq("updated_at", abandonedUpdatedAt);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw new Error(error.message);
      return data ? token : null;
    },
    now: () => Date.now(),
  });
}

/**
 * After a chunk: a finished step is released only by the token that owns it (a request that lost
 * the claim gets 409 and leaves the new owner's claim alone); an unfinished step keeps the claim
 * and hands its token back for the next chunk.
 */
export async function completeImportChunkWithDeps<TResult extends { done: boolean }>(
  phase: ImportChunkPhase,
  token: string,
  result: TResult,
  release: (token: string) => Promise<boolean>,
): Promise<TResult & { claim_token: string | null }> {
  if (!result.done) return { ...result, claim_token: token };
  if (!(await release(token))) {
    throw new SponsorImportHttpError(409, IMPORT_CHUNK_CLAIM_LOST_MESSAGE, { processing_phase: phase });
  }
  return { ...result, claim_token: null };
}

/** Ends an import step only while `token` still owns it; false if it no longer does. */
async function releaseImportChunkClaim(
  batchId: string,
  phase: ImportChunkPhase,
  token: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sponsor_import_batches")
    .update({ processing_phase: null, updated_at: new Date().toISOString() })
    .eq("id", batchId)
    .eq("status", "review")
    .eq("processing_phase", phase)
    .eq("updated_at", token)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export type PrepareReviewMutationDeps = {
  readBatch: () => Promise<BatchRow>;
  recoverStaleImportClaim: (batch: BatchRow) => Promise<boolean>;
};

/**
 * The batch a Review decision may write to: in review, with no live workflow claim. An import
 * claim abandoned by a failed chunk is recovered once stale, so the reviewer can fix the row
 * that made it fail; a live claim, of any workflow, is left untouched and rejected with 409.
 */
export async function prepareReviewMutationWithDeps(deps: PrepareReviewMutationDeps): Promise<BatchRow> {
  let batch = await deps.readBatch();
  assertBatchStatus(batch, ["review"]);
  if (await deps.recoverStaleImportClaim(batch)) {
    batch = await deps.readBatch();
    assertBatchStatus(batch, ["review"]);
  }
  assertNoActiveProcessingPhase(batch);
  return batch;
}

function prepareReviewMutation(batchId: string): Promise<BatchRow> {
  return prepareReviewMutationWithDeps({
    readBatch: () => getBatchRow(batchId),
    recoverStaleImportClaim: (batch) => recoverStaleImportProcessingPhase(batchId, batch),
  });
}

/** @deprecated Use recoverStaleImportProcessingPhase */
async function recoverStaleImportToDraftPhase(
  batchId: string,
  batch: BatchRow,
): Promise<boolean> {
  return recoverStaleImportProcessingPhase(batchId, batch);
}

export async function buildCompletedDraftLinksMaterializationResult(
  batchId: string,
): Promise<MaterializeDraftLinksChunkResult> {
  const supabase = createAdminClient();
  const { count: totalResolved, error: totalError } = await supabase
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (totalError) throw new Error(totalError.message);

  const { count: linked, error: linkedError } = await supabase
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .not("draft_link_id", "is", null);

  if (linkedError) throw new Error(linkedError.message);

  const total = totalResolved ?? 0;
  const linkedTotal = linked ?? 0;

  return {
    examined_count: 0,
    skipped_count: 0,
    links_created: 0,
    links_updated: 0,
    rows_linked: 0,
    total_resolved_rows: total,
    rows_with_draft_link: linkedTotal,
    conflict_count: 0,
    done: true,
    next_cursor: null,
    claim_token: null,
  };
}

export type ImportChunkOptions = {
  cursor?: number;
  limit?: number;
  /** The `claim_token` the previous chunk of this import step returned. */
  claimToken?: string | null;
};

async function executeRunMaterializeCompaniesChunk(
  batchId: string,
  actorId: string,
  options: ImportChunkOptions = {},
): Promise<MaterializeCompaniesChunkResult> {
  let batch = await getBatchRow(batchId);
  if (batch.status === "draft") {
    return buildCompletedCompanyMaterializationResult(batchId);
  }
  assertBatchStatus(batch, ["review"]);

  if (await recoverStaleImportProcessingPhase(batchId, batch)) {
    batch = await getBatchRow(batchId);
  }

  const rows = await loadImportRows(batchId);
  assertImportToDraftGuards(rows);

  if (batch.processing_phase === "importing_to_draft") {
    if (await isCompanyMaterializationComplete(batchId)) {
      return buildCompletedCompanyMaterializationResult(batchId);
    }
    throw new SponsorImportHttpError(
      409,
      "Import-to-draft is already in progress.",
    );
  }

  const claim = await acquireImportChunkClaim(
    batchId,
    "materializing_companies",
    batch,
    options.claimToken ?? null,
  );
  if (!claim.acquired) {
    batch = claim.batch;
    if (batch.processing_phase === "importing_to_draft") {
      if (await isCompanyMaterializationComplete(batchId)) {
        return buildCompletedCompanyMaterializationResult(batchId);
      }
      throw new SponsorImportHttpError(
        409,
        "Import-to-draft is already in progress.",
      );
    }
    throw new SponsorImportHttpError(
      409,
      "Company materialization could not start. Refresh the page and try again.",
      { status: batch.status, processing_phase: batch.processing_phase },
    );
  }

  const chunk = await materializeCompaniesChunk(batchId, {
    cursor: options.cursor,
    limit: options.limit,
  });
  if ((chunk.duplicate_name_review_count ?? 0) > 0) {
    await releaseImportChunkClaim(batchId, "materializing_companies", claim.token);
    await appendActionLog({
      batchId,
      actorId,
      actionType: "materialize_companies_chunk",
      payload: chunk,
      affectedCount: chunk.materialized_count,
    });
    throw new SponsorImportHttpError(409, DUPLICATE_NAME_IMPORT_STOPPED_MESSAGE);
  }
  const result = await completeImportChunkWithDeps("materializing_companies", claim.token, chunk, (token) =>
    releaseImportChunkClaim(batchId, "materializing_companies", token),
  );

  await appendActionLog({
    batchId,
    actorId,
    actionType: "materialize_companies_chunk",
    payload: result,
    affectedCount: result.materialized_count,
  });

  return result;
}

export async function runMaterializeCompaniesChunk(
  batchId: string,
  actorId: string,
  options: ImportChunkOptions = {},
): Promise<MaterializeCompaniesChunkResult> {
  return withImportToDraftPipelineLog(
    {
      batchId,
      phase: "materialize_companies_chunk",
      actorId,
      cursor: options.cursor,
      limit: options.limit,
    },
    () => executeRunMaterializeCompaniesChunk(batchId, actorId, options),
    summarizeMaterializeCompaniesChunkResult,
  );
}

async function isCompanyMaterializationComplete(batchId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .is("resolved_company_id", null);

  if (error) throw new Error(error.message);
  return (count ?? 0) === 0;
}

export async function buildCompletedCompanyMaterializationResult(
  batchId: string,
): Promise<MaterializeCompaniesChunkResult> {
  const supabase = createAdminClient();
  const { count: totalResolved, error } = await supabase
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (error) throw new Error(error.message);

  const total = totalResolved ?? 0;
  return {
    examined_count: 0,
    skipped_count: 0,
    materialized_count: 0,
    companies_created: 0,
    total_resolved_rows: total,
    rows_with_company_id: total,
    conflict_count: 0,
    done: true,
    next_cursor: null,
    claim_token: null,
  };
}

async function assertCompanyMaterializationComplete(batchId: string): Promise<void> {
  if (!(await isCompanyMaterializationComplete(batchId))) {
    throw new SponsorImportHttpError(
      409,
      "Company materialization must finish before creating draft links.",
    );
  }
}

async function assertAllResolvedRowsLinked(batchId: string): Promise<void> {
  const supabase = createAdminClient();
  const { count: totalResolved, error: totalError } = await supabase
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (totalError) throw new Error(totalError.message);

  const { count: linked, error: linkedError } = await supabase
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .not("draft_link_id", "is", null);

  if (linkedError) throw new Error(linkedError.message);

  const resolvedTotal = totalResolved ?? 0;
  const linkedTotal = linked ?? 0;

  if (resolvedTotal === 0) {
    throw new SponsorImportHttpError(422, "No resolved rows to import to draft.");
  }

  if (linkedTotal < resolvedTotal) {
    throw new SponsorImportHttpError(
      422,
      "Draft-link materialization is incomplete. Finish creating draft links before finalizing.",
      { resolved_rows: resolvedTotal, rows_with_draft_link: linkedTotal },
    );
  }
}

export const DRAFT_LINKS_INCONSISTENT_MESSAGE =
  "Import to draft cannot finish because some draft links no longer match the reviewed rows. Discard this import and start again.";

export type DraftLinkConsistencyLink = { id: string; company_id: string };
export type DraftLinkConsistencyRow = {
  id: string;
  status: string;
  resolved_company_id: string | null;
  draft_link_id: string | null;
};

/**
 * Publishing reads draft links only, so before a batch becomes a draft every link must be backed
 * by a resolved row of the same company, and no excluded row may still point at a link.
 */
export function findDraftLinkInconsistencies(
  links: readonly DraftLinkConsistencyLink[],
  rows: readonly DraftLinkConsistencyRow[],
): { unbacked_link_ids: string[]; excluded_linked_row_ids: string[] } {
  const backedLinkIds = new Set(
    rows
      .filter((row) => row.status === "resolved" && row.draft_link_id !== null)
      .flatMap((row) => {
        const link = links.find((candidate) => candidate.id === row.draft_link_id);
        return link && link.company_id === row.resolved_company_id ? [link.id] : [];
      }),
  );
  return {
    unbacked_link_ids: links.filter((link) => !backedLinkIds.has(link.id)).map((link) => link.id),
    excluded_linked_row_ids: rows
      .filter((row) => row.status === "excluded" && row.draft_link_id !== null)
      .map((row) => row.id),
  };
}

async function assertDraftLinksMatchRows(batchId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: links, error: linksError } = await supabase
    .from("sponsor_import_draft_links")
    .select("id, company_id")
    .eq("batch_id", batchId);
  if (linksError) throw new Error(linksError.message);

  const { data: rows, error: rowsError } = await supabase
    .from("sponsor_import_rows")
    .select("id, status, resolved_company_id, draft_link_id")
    .eq("batch_id", batchId)
    .not("draft_link_id", "is", null);
  if (rowsError) throw new Error(rowsError.message);

  const inconsistencies = findDraftLinkInconsistencies(
    (links ?? []).map((link) => ({ id: String(link.id), company_id: String(link.company_id) })),
    (rows ?? []).map((row) => ({
      id: String(row.id),
      status: String(row.status),
      resolved_company_id: typeof row.resolved_company_id === "string" ? row.resolved_company_id : null,
      draft_link_id: typeof row.draft_link_id === "string" ? row.draft_link_id : null,
    })),
  );
  if (inconsistencies.unbacked_link_ids.length > 0 || inconsistencies.excluded_linked_row_ids.length > 0) {
    throw new SponsorImportHttpError(409, DRAFT_LINKS_INCONSISTENT_MESSAGE, inconsistencies);
  }
}

export function assertImportToDraftNotBlockedByProcessingPhase(
  batch: Pick<BatchRow, "processing_phase">,
): void {
  assertNotMatching(batch);
  if (batch.processing_phase === "validating") {
    throw new SponsorImportHttpError(
      409,
      "Validation is in progress. Wait for it to finish before import-to-draft.",
    );
  }
  if (batch.processing_phase === "parsing") {
    throw new SponsorImportHttpError(
      409,
      "Column mapping is being saved. Wait for it to finish before import-to-draft.",
    );
  }
  if (batch.processing_phase === "materializing_companies") {
    throw new SponsorImportHttpError(
      409,
      "Company materialization is in progress. Wait for it to finish before import-to-draft.",
    );
  }
  if (batch.processing_phase === "importing_to_draft") {
    throw new SponsorImportHttpError(
      409,
      "Draft-link materialization is in progress. Wait for it to finish before finalizing.",
    );
  }
}

async function executeRunMaterializeDraftLinksChunk(
  batchId: string,
  actorId: string,
  options: ImportChunkOptions = {},
): Promise<MaterializeDraftLinksChunkResult> {
  let batch = await getBatchRow(batchId);
  if (batch.status === "draft") {
    return buildCompletedDraftLinksMaterializationResult(batchId);
  }
  assertBatchStatus(batch, ["review"]);

  if (await recoverStaleImportProcessingPhase(batchId, batch)) {
    batch = await getBatchRow(batchId);
  }

  if (batch.processing_phase === "materializing_companies") {
    throw new SponsorImportHttpError(
      409,
      "Company materialization is in progress. Wait for it to finish before creating draft links.",
    );
  }

  const rows = await loadImportRows(batchId);
  assertImportToDraftGuards(rows);
  await assertCompanyMaterializationComplete(batchId);

  const claim = await acquireImportChunkClaim(
    batchId,
    "importing_to_draft",
    batch,
    options.claimToken ?? null,
  );
  if (!claim.acquired) {
    batch = claim.batch;
    if (batch.processing_phase === "materializing_companies") {
      throw new SponsorImportHttpError(
        409,
        "Company materialization is in progress. Wait for it to finish before creating draft links.",
      );
    }
    throw new SponsorImportHttpError(
      409,
      "Draft-link materialization could not start. Refresh the page and try again.",
      { status: batch.status, processing_phase: batch.processing_phase },
    );
  }

  const chunk = await materializeDraftLinksChunk(batchId, String(batch.event_edition_id), {
    cursor: options.cursor,
    limit: options.limit,
  });
  const result = await completeImportChunkWithDeps("importing_to_draft", claim.token, chunk, (token) =>
    releaseImportChunkClaim(batchId, "importing_to_draft", token),
  );

  await appendActionLog({
    batchId,
    actorId,
    actionType: "materialize_draft_links_chunk",
    payload: result,
    affectedCount: result.rows_linked,
  });

  return result;
}

export async function runMaterializeDraftLinksChunk(
  batchId: string,
  actorId: string,
  options: ImportChunkOptions = {},
): Promise<MaterializeDraftLinksChunkResult> {
  return withImportToDraftPipelineLog(
    {
      batchId,
      phase: "materialize_draft_links_chunk",
      actorId,
      cursor: options.cursor,
      limit: options.limit,
    },
    () => executeRunMaterializeDraftLinksChunk(batchId, actorId, options),
    summarizeMaterializeDraftLinksChunkResult,
  );
}

async function executeImportBatchToDraft(
  batchId: string,
  actorId: string,
): Promise<ImportToDraftResult> {
  let batch = await getBatchRow(batchId);

  if (batch.status === "draft") {
    return resolveIdempotentImportToDraftResult(batchId);
  }

  assertBatchStatus(batch, ["review"]);

  if (await recoverStaleImportToDraftPhase(batchId, batch)) {
    batch = await getBatchRow(batchId);
    if (batch.status === "draft") {
      return resolveIdempotentImportToDraftResult(batchId);
    }
  }

  assertImportToDraftNotBlockedByProcessingPhase(batch);

  const rows = await loadImportRows(batchId);
  assertImportToDraftGuards(rows);
  await assertCompanyMaterializationComplete(batchId);
  await assertAllResolvedRowsLinked(batchId);
  await assertDraftLinksMatchRows(batchId);

  const supabase = createAdminClient();
  const result = await summarizeImportToDraftFromDb(batchId);

  const { data: finalized, error: updateError } = await supabase
    .from("sponsor_import_batches")
    .update({
      status: "draft",
      processing_phase: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .eq("status", "review")
    // A workflow that claimed after the guard above (e.g. validation) is never displaced.
    .is("processing_phase", null)
    .select("id")
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);

  if (!finalized) {
    batch = await getBatchRow(batchId);
    if (batch.status === "draft") {
      return resolveIdempotentImportToDraftResult(batchId);
    }
    throw new SponsorImportHttpError(
      409,
      "Import to draft could not finalize. Refresh the page and try again.",
      { status: batch.status, processing_phase: batch.processing_phase },
    );
  }

  await appendActionLog({
    batchId,
    actorId,
    actionType: "import_to_draft",
    payload: result,
    affectedCount: result.rows_materialized,
  });

  return result;
}

export async function importBatchToDraft(
  batchId: string,
  actorId: string,
): Promise<ImportToDraftResult> {
  return withImportToDraftPipelineLog(
    {
      batchId,
      phase: "import_to_draft_finalize",
      actorId,
    },
    () => executeImportBatchToDraft(batchId, actorId),
    summarizeImportToDraftFinalizeResult,
  );
}

export async function listDraftLinks(batchId: string) {
  const batch = await getBatchRow(batchId);
  const supabase = createAdminClient();

  const { data: links, error } = await supabase
    .from("sponsor_import_draft_links")
    .select(
      "id, batch_id, event_edition_id, company_id, tier_rank, tier_label, source_import_row_id, excluded_from_publish, created_at, updated_at, companies(id, name, slug, domain)",
    )
    .eq("batch_id", batchId)
    .order("tier_rank", { ascending: true });

  if (error) throw new Error(error.message);

  const { data: live, error: liveError } = await supabase
    .from("event_sponsors")
    .select("company_id, tier_rank")
    .eq("event_editions_id", batch.event_edition_id);

  if (liveError) throw new Error(liveError.message);

  const liveMap = new Map<string, number | null>();
  for (const row of live ?? []) {
    liveMap.set(String(row.company_id), row.tier_rank as number | null);
  }

  const diff: DraftDiffSummary = { new: 0, tier_updated: 0, unchanged: 0, excluded: 0 };
  for (const link of links ?? []) {
    if (link.excluded_from_publish) {
      diff.excluded += 1;
      continue;
    }
    const liveTier = liveMap.get(String(link.company_id));
    if (liveTier === undefined) diff.new += 1;
    else if (liveTier !== link.tier_rank) diff.tier_updated += 1;
    else diff.unchanged += 1;
  }

  return { links: links ?? [], diff };
}

export async function patchDraftLink(
  batchId: string,
  linkId: string,
  input: { tier_rank?: number; excluded_from_publish?: boolean },
) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["draft"]);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.tier_rank !== undefined) {
    if (!Number.isInteger(input.tier_rank) || input.tier_rank < 1) {
      throw new SponsorImportHttpError(400, "tier_rank must be an integer >= 1.");
    }
    patch.tier_rank = input.tier_rank;
  }
  if (input.excluded_from_publish !== undefined) {
    patch.excluded_from_publish = input.excluded_from_publish;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sponsor_import_draft_links")
    .update(patch)
    .eq("batch_id", batchId)
    .eq("id", linkId)
    .select(
      "id, batch_id, event_edition_id, company_id, tier_rank, source_import_row_id, excluded_from_publish, created_at, updated_at",
    )
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function acknowledgeReview(batchId: string, actorId: string) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["draft"]);

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sponsor_import_batches")
    .update({
      review_acknowledged_at: now,
      review_acknowledged_by: actorId,
      updated_at: now,
    })
    .eq("id", batchId)
    .select(BATCH_SELECT)
    .single();

  if (error) throw new Error(error.message);

  await appendActionLog({
    batchId,
    actorId,
    actionType: "review_acknowledged",
  });

  return data;
}

export async function publishBatch(batchId: string, actorId: string): Promise<PublishResult> {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["draft"]);
  if (!batch.review_acknowledged_at) {
    throw new SponsorImportHttpError(422, "Review must be acknowledged before publish.");
  }

  const storagePath =
    typeof batch.source_file_storage_path === "string"
      ? batch.source_file_storage_path
      : null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("sponsor_import_publish_batch", {
    p_batch_id: batchId,
    p_published_by: actorId,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("invalid_batch_status")) {
      throw new SponsorImportHttpError(409, "Batch is not in draft status.");
    }
    if (msg.includes("review_not_acknowledged")) {
      throw new SponsorImportHttpError(422, "Review not acknowledged.");
    }
    throw new Error(msg);
  }

  const raw = data as Record<string, number> | null;
  const result: PublishResult = {
    new_count: raw?.new_count ?? 0,
    tier_updated_count: raw?.tier_updated_count ?? 0,
    unchanged_count: raw?.unchanged_count ?? 0,
    excluded_count: raw?.excluded_count ?? 0,
  };

  try {
    await deleteImportBatchData({ batchId, storagePath });
  } catch (cleanupError) {
    console.error(
      `[sponsor-import] publish cleanup failed for batch ${batchId}:`,
      cleanupError,
    );
  }

  return result;
}

type DeleteImportBatchDataInput = {
  batchId: string;
  storagePath?: string | null;
};

/** Permanently remove temporary import data for a batch (rows, draft links, logs, storage file). */
async function deleteImportBatchData({
  batchId,
  storagePath,
}: DeleteImportBatchDataInput): Promise<void> {
  const supabase = createAdminClient();
  const normalizedStoragePath = storagePath?.trim() ?? "";

  if (normalizedStoragePath) {
    await deleteSourceFile(normalizedStoragePath);
  }

  const { error: draftLinksError } = await supabase
    .from("sponsor_import_draft_links")
    .delete()
    .eq("batch_id", batchId);
  if (draftLinksError) throw new Error(draftLinksError.message);

  const { error: duplicateClearError } = await supabase
    .from("sponsor_import_rows")
    .update({ duplicate_of_row_id: null })
    .eq("batch_id", batchId);
  if (duplicateClearError) throw new Error(duplicateClearError.message);

  const { error: deleteBatchError } = await supabase
    .from("sponsor_import_batches")
    .delete()
    .eq("id", batchId);
  if (deleteBatchError) throw new Error(deleteBatchError.message);
}

export type DiscardBatchResult = {
  event_edition_id: string;
};

/** Permanently remove an active import batch and all temporary import data. */
export async function discardBatch(batchId: string): Promise<DiscardBatchResult> {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["uploaded", "review", "draft"]);

  const eventEditionId = String(batch.event_edition_id);
  await deleteImportBatchData({
    batchId,
    storagePath:
      typeof batch.source_file_storage_path === "string"
        ? batch.source_file_storage_path
        : null,
  });

  return { event_edition_id: eventEditionId };
}

export async function listActionLogs(batchId: string) {
  await getBatchRow(batchId);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sponsor_import_admin_action_logs")
    .select("id, batch_id, actor_id, action_type, payload, affected_count, created_at")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function buildOutcomeReportCsv(batchId: string): Promise<string> {
  await getBatchRow(batchId);
  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("sponsor_import_rows")
    .select(
      "excel_row_number, raw_company_name, normalized_domain, mapped_tier_rank, mapped_tier_label, status, decision_type, resolved_company_id, import_error, draft_link_id",
    )
    .eq("batch_id", batchId)
    .order("excel_row_number", { ascending: true });

  if (error) throw new Error(error.message);

  const header = [
    "excel_row_number",
    "company_name",
    "domain",
    "tier_rank",
    "tier_label",
    "status",
    "decision_type",
    "resolved_company_id",
    "draft_link_id",
    "import_error",
  ].join(",");

  const lines = (rows ?? []).map((r) => {
    const cells = [
      r.excel_row_number,
      JSON.stringify(r.raw_company_name ?? ""),
      JSON.stringify(r.normalized_domain ?? ""),
      r.mapped_tier_rank ?? "",
      JSON.stringify(r.mapped_tier_label ?? ""),
      r.status,
      r.decision_type ?? "",
      r.resolved_company_id ?? "",
      r.draft_link_id ?? "",
      JSON.stringify(r.import_error ?? ""),
    ];
    return cells.join(",");
  });

  return [header, ...lines].join("\n");
}

export { parseColumnMapping };
