import { createAdminClient } from "@/src/lib/supabase/admin";

import type {
  ColumnMapping,
  DraftDiffSummary,
  ImportToDraftResult,
  MaterializeCompaniesChunkResult,
  MaterializeDraftLinksChunkResult,
  PublishResult,
  RowSummary,
  ExhibitorImportBatchStatus,
  ExhibitorImportDecisionType,
} from "../types";
import { appendActionLog } from "./actionLog";
import {
  assertBatchStatus,
  assertImportToDraftGuards,
  isStaleImportProcessingPhaseClaim,
  summarizeRows,
  type BatchRow,
  type ImportRowRecord,
} from "./batchGuards";
import { ExhibitorImportHttpError } from "./errors";
import {
  CompanyDomainLinkError,
  ensureCompanyDomainFromImportLink,
} from "@/src/lib/companies/linkCompanyDomainFromImport";
import {
  assertCompanyLinkable,
  COMPANY_NOT_LINKABLE_MESSAGE,
} from "@/src/lib/companies/assertCompanyLinkable";
import { loadMatchContext, matchRow, AUTO_READY_MATCH_METHODS } from "./matchRows";
import { materializeCompaniesChunk } from "./materializeCompanies";
import { materializeDraftLinksChunk } from "./materializeDraft";
import {
  detectSourceFormat,
  guessColumnMapping,
  parseWithColumnMapping,
  readSpreadsheetHeaders,
} from "./parseSpreadsheet";
import { EXHIBITOR_IMPORT_BUCKET, EXHIBITOR_IMPORT_MAX_ROWS } from "../types";
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
  "id, batch_id, excel_row_number, raw_company_name, raw_website, raw_tier_rank, raw_tier_label, normalized_company_name, normalized_website, normalized_domain, proposed_slug, mapped_tier_rank, mapped_tier_label, status, validation_issues, has_blocking_validation, match_method, match_confidence, proposed_company_id, conflict_type, decision_type, decision_source, resolved_company_id, decision_by, decision_at, decision_notes, duplicate_cluster_key, duplicate_role, duplicate_of_row_id, duplicate_resolution, already_on_live_exhibitor_id, already_on_live_tier_rank, intended_link_action, draft_link_id, import_error, created_at, updated_at";

export type DuplicateClusterDecisionRow = {
  id: string;
  duplicate_cluster_key: string | null;
};

export type DuplicateClusterDecisionPatch = {
  id: string;
  patch: Record<string, unknown>;
  role: "survivor" | "excluded_sibling";
};

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
    throw new ExhibitorImportHttpError(400, "column_mapping must be an object.");
  }
  const o = raw as Record<string, unknown>;
  const company_name = typeof o.company_name === "string" ? o.company_name.trim() : "";
  const website = typeof o.website === "string" ? o.website.trim() : "";
  const tier_rank = typeof o.tier_rank === "string" ? o.tier_rank.trim() : "";
  const tier_label = typeof o.tier_label === "string" ? o.tier_label.trim() : "";
  if (!company_name || !website || !tier_rank || !tier_label) {
    throw new ExhibitorImportHttpError(
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
    .from("exhibitor_import_batches")
    .select(BATCH_SELECT)
    .eq("id", batchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ExhibitorImportHttpError(404, "Batch not found.");
  return data as BatchRow & Record<string, unknown>;
}

async function loadImportRows(batchId: string): Promise<ImportRowRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("exhibitor_import_rows")
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
  if (!data) throw new ExhibitorImportHttpError(404, "Event not found.");
}

export async function listBatchesAdmin(filters: {
  editionId?: string;
  status?: ExhibitorImportBatchStatus;
  limit?: number;
  offset?: number;
}) {
  const supabase = createAdminClient();
  let query = supabase
    .from("exhibitor_import_batches")
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
    .from(EXHIBITOR_IMPORT_BUCKET)
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
    .from("exhibitor_import_batches")
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
      throw new ExhibitorImportHttpError(400, "Could not infer column mapping; provide column_mapping.");
    }
  }

  const { rows, sheetName } = parseWithColumnMapping(buffer, mapping);
  if (rows.length === 0) {
    throw new ExhibitorImportHttpError(400, "No data rows found in spreadsheet.");
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
    .from("exhibitor_import_batches")
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

  if (batchError) {
    try {
      await deleteSourceFile(storagePath);
    } catch {
      // Best-effort cleanup; surface the original insert failure.
    }
    throw new Error(batchError.message);
  }

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

  const { error: rowsError } = await supabase.from("exhibitor_import_rows").insert(rowInserts);
  if (rowsError) {
    await supabase.from("exhibitor_import_batches").delete().eq("id", batchId);
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

export async function saveColumnMapping(
  batchId: string,
  actorId: string,
  mapping: ColumnMapping,
  transitionToReview: boolean,
) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["uploaded", "review"]);

  const supabase = createAdminClient();
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(EXHIBITOR_IMPORT_BUCKET)
    .download(batch.source_file_storage_path as string);

  if (downloadError || !fileData) {
    throw new Error(downloadError?.message ?? "Failed to download source file.");
  }

  const buffer = await fileData.arrayBuffer();
  const { rows, sheetName } = parseWithColumnMapping(buffer, mapping);

  await supabase.from("exhibitor_import_rows").delete().eq("batch_id", batchId);

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("exhibitor_import_rows").insert(
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
  }

  const nextStatus: ExhibitorImportBatchStatus = transitionToReview ? "review" : batch.status;

  const { data: updated, error: updateError } = await supabase
    .from("exhibitor_import_batches")
    .update({
      column_mapping: mapping,
      source_sheet_name: sheetName,
      source_row_count: rows.length,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .select(BATCH_SELECT)
    .single();

  if (updateError) throw new Error(updateError.message);

  await appendActionLog({
    batchId,
    actorId,
    actionType: "column_mapping_saved",
    payload: { mapping, row_count: rows.length },
    affectedCount: rows.length,
  });

  return updated;
}

export async function runBatchValidation(batchId: string, actorId: string) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["uploaded", "review"]);

  const supabase = createAdminClient();
  await supabase
    .from("exhibitor_import_batches")
    .update({ processing_phase: "validating", updated_at: new Date().toISOString() })
    .eq("id", batchId);

  const { data: rawRows, error } = await supabase
    .from("exhibitor_import_rows")
    .select(
      "id, excel_row_number, raw_company_name, raw_website, raw_tier_rank, raw_tier_label, status",
    )
    .eq("batch_id", batchId)
    .order("excel_row_number", { ascending: true });

  if (error) throw new Error(error.message);

  const validated = assignDuplicateClusters(
    (rawRows ?? []).map((r) => {
      const v = validateRow({
        id: String(r.id),
        excel_row_number: Number(r.excel_row_number),
        raw_company_name: r.raw_company_name as string | null,
        raw_website: r.raw_website as string | null,
        raw_tier_rank: r.raw_tier_rank as number | null,
        raw_tier_label: r.raw_tier_label as string | null,
        status: String(r.status),
      });
      return { ...v, id: String(r.id), excel_row_number: Number(r.excel_row_number), status: String(r.status) };
    }),
  );

  for (const row of validated) {
    const prior = rawRows?.find((x) => String(x.id) === row.id);
    const priorStatus = prior ? String(prior.status) : "needs_review";
    const nextStatus =
      row.duplicate_resolution === "excluded" || priorStatus === "excluded"
        ? "excluded"
        : row.has_blocking_validation
          ? "needs_review"
          : priorStatus;

    const { error: rowError } = await supabase
      .from("exhibitor_import_rows")
      .update({
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
      })
      .eq("id", row.id);
    if (rowError) throw new Error(rowError.message);
  }

  await supabase
    .from("exhibitor_import_batches")
    .update({
      status: "review",
      processing_phase: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  await appendActionLog({
    batchId,
    actorId,
    actionType: "validation_run",
    affectedCount: validated.length,
  });

  return { validated_count: validated.length };
}

export async function runBatchMatching(batchId: string, actorId: string) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["review"]);

  const supabase = createAdminClient();
  await supabase
    .from("exhibitor_import_batches")
    .update({ processing_phase: "matching", updated_at: new Date().toISOString() })
    .eq("id", batchId);

  const { matchContext, liveByCompanyId } = await loadMatchContext(
    String(batch.event_edition_id),
  );

  const { data: rows, error } = await supabase
    .from("exhibitor_import_rows")
    .select(
      "id, status, normalized_domain, normalized_website, normalized_company_name, mapped_tier_rank, has_blocking_validation",
    )
    .eq("batch_id", batchId);

  if (error) throw new Error(error.message);

  let matched = 0;
  for (const row of rows ?? []) {
    const status = String(row.status);
    if (status === "resolved" || status === "excluded") continue;

    const result = await matchRow(
      {
        id: String(row.id),
        status: status as ImportRowRecord["status"],
        normalized_domain: row.normalized_domain as string | null,
        normalized_website: row.normalized_website as string | null,
        normalized_company_name: row.normalized_company_name as string | null,
        mapped_tier_rank: row.mapped_tier_rank as number | null,
        has_blocking_validation: Boolean(row.has_blocking_validation),
      },
      matchContext,
      liveByCompanyId,
    );

    const { error: updateError } = await supabase
      .from("exhibitor_import_rows")
      .update({
        status: result.status,
        match_method: result.match_method,
        match_confidence: result.match_confidence,
        proposed_company_id: result.proposed_company_id,
        conflict_type: result.conflict_type,
        already_on_live_exhibitor_id: result.already_on_live_exhibitor_id,
        already_on_live_tier_rank: result.already_on_live_tier_rank,
        intended_link_action: result.intended_link_action,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) throw new Error(updateError.message);
    matched += 1;
  }

  await supabase
    .from("exhibitor_import_batches")
    .update({ processing_phase: null, updated_at: new Date().toISOString() })
    .eq("id", batchId);

  await appendActionLog({
    batchId,
    actorId,
    actionType: "matching_run",
    affectedCount: matched,
  });

  return { matched_count: matched };
}

export async function bulkAcceptDomainMatches(batchId: string, actorId: string) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["review"]);

  const supabase = createAdminClient();

  return bulkAcceptDomainMatchesWithDeps(batchId, actorId, {
    fetchAutoReadyRows: async (targetBatchId) => {
      const { data, error } = await supabase
        .from("exhibitor_import_rows")
        .select("id, proposed_company_id")
        .eq("batch_id", targetBatchId)
        .eq("status", "auto_ready")
        .eq("match_confidence", "high")
        .in("match_method", [...AUTO_READY_MATCH_METHODS]);

      if (error) throw new Error(error.message);
      return (data ?? []) as BulkAcceptDomainMatchRow[];
    },
    resolveRow: async (rowId, patch) => {
      const { error } = await supabase.from("exhibitor_import_rows").update(patch).eq("id", rowId);
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
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["review"]);

  const uniqueIds = Array.from(new Set(input.row_ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    throw new ExhibitorImportHttpError(400, "row_ids must not be empty.");
  }
  if (uniqueIds.length > EXHIBITOR_IMPORT_MAX_ROWS) {
    throw new ExhibitorImportHttpError(
      400,
      `Maximum ${EXHIBITOR_IMPORT_MAX_ROWS} rows per bulk action.`,
    );
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("exhibitor_import_rows")
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
        .from("exhibitor_import_rows")
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
      .from("exhibitor_import_rows")
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
    .from("exhibitor_import_rows")
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
    .from("exhibitor_import_rows")
    .select(ROW_SELECT)
    .eq("batch_id", batchId)
    .eq("id", rowId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ExhibitorImportHttpError(404, "Row not found.");
  const [row] = await enrichImportRowsWithProposedCompanies([data]);
  return row ?? data;
}

async function maybeLinkReviewedImportDomain(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    decision_type: ExhibitorImportDecisionType;
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
      throw new ExhibitorImportHttpError(error.status, error.message);
    }
    throw error;
  }
}

async function assertResolvedCompanyLinkable(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<void> {
  const { data: company, error } = await supabase
    .from("companies")
    .select("status, merged_into_company_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  try {
    assertCompanyLinkable(company);
  } catch {
    throw new ExhibitorImportHttpError(422, COMPANY_NOT_LINKABLE_MESSAGE, {
      company_id: companyId,
    });
  }
}

export async function patchRowDecision(
  batchId: string,
  rowId: string,
  actorId: string,
  input: {
    decision_type: ExhibitorImportDecisionType;
    resolved_company_id?: string | null;
    decision_notes?: string | null;
    duplicate_resolution?: "kept" | "excluded" | "pending" | null;
  },
) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["review"]);

  const supabase = createAdminClient();
  const { data: row, error: rowError } = await supabase
    .from("exhibitor_import_rows")
    .select("id, proposed_company_id, duplicate_role, duplicate_cluster_key, normalized_domain")
    .eq("batch_id", batchId)
    .eq("id", rowId)
    .maybeSingle();

  if (rowError) throw new Error(rowError.message);
  if (!row) throw new ExhibitorImportHttpError(404, "Row not found.");

  const now = new Date().toISOString();
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
      throw new ExhibitorImportHttpError(400, "No proposed company to use.");
    }
    await assertResolvedCompanyLinkable(supabase, String(companyId));
    patch.status = "resolved";
    patch.resolved_company_id = companyId;
  } else if (input.decision_type === "choose_different") {
    if (!input.resolved_company_id) {
      throw new ExhibitorImportHttpError(400, "resolved_company_id required.");
    }
    await assertResolvedCompanyLinkable(supabase, input.resolved_company_id);
    patch.status = "resolved";
    patch.resolved_company_id = input.resolved_company_id;
  } else if (input.decision_type === "create_new") {
    patch.status = "resolved";
    patch.resolved_company_id = null;
  }

  await maybeLinkReviewedImportDomain(supabase, {
    decision_type: input.decision_type,
    resolved_company_id: input.resolved_company_id,
    proposed_company_id:
      typeof row.proposed_company_id === "string" ? row.proposed_company_id : null,
    normalized_domain:
      typeof row.normalized_domain === "string" ? row.normalized_domain : null,
  });

  const duplicateClusterKey =
    typeof row.duplicate_cluster_key === "string" ? row.duplicate_cluster_key.trim() : "";
  const resolvesDuplicateCluster =
    duplicateClusterKey !== "" &&
    input.duplicate_resolution === "kept" &&
    input.decision_type !== "exclude";

  if (resolvesDuplicateCluster) {
    const { data: clusterRows, error: clusterError } = await supabase
      .from("exhibitor_import_rows")
      .select("id, duplicate_cluster_key")
      .eq("batch_id", batchId)
      .eq("duplicate_cluster_key", duplicateClusterKey);

    if (clusterError) throw new Error(clusterError.message);

    const patches = buildDuplicateClusterKeepPatches({
      clusterRows: ((clusterRows ?? []) as DuplicateClusterDecisionRow[]).map((clusterRow) => ({
        id: String(clusterRow.id),
        duplicate_cluster_key:
          typeof clusterRow.duplicate_cluster_key === "string"
            ? clusterRow.duplicate_cluster_key
            : null,
      })),
      selectedRowId: rowId,
      selectedPatch: patch,
      actorId,
      now,
    });

    let updatedSelected:
      | (Record<string, unknown> & { proposed_company_id: string | null })
      | null = null;
    for (const item of patches) {
      const query = supabase
        .from("exhibitor_import_rows")
        .update(item.patch)
        .eq("id", item.id);

      if (item.role === "survivor") {
        const { data: updated, error: updateError } = await query.select(ROW_SELECT).single();
        if (updateError) throw new Error(updateError.message);
        updatedSelected = updated as Record<string, unknown> & {
          proposed_company_id: string | null;
        };
      } else {
        const { error: updateError } = await query;
        if (updateError) throw new Error(updateError.message);
      }
    }

    if (!updatedSelected) {
      throw new ExhibitorImportHttpError(404, "Selected duplicate row not found.");
    }

    const [enrichedRow] = await enrichImportRowsWithProposedCompanies([updatedSelected]);
    return enrichedRow ?? updatedSelected;
  }

  const { data: updated, error: updateError } = await supabase
    .from("exhibitor_import_rows")
    .update(patch)
    .eq("id", rowId)
    .select(ROW_SELECT)
    .single();

  if (updateError) throw new Error(updateError.message);
  const [enrichedRow] = await enrichImportRowsWithProposedCompanies([updated]);
  return enrichedRow ?? updated;
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
    .from("exhibitor_import_admin_action_logs")
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
    .from("exhibitor_import_admin_action_logs")
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
    .from("exhibitor_import_draft_links")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);
  if (linkError) throw new Error(linkError.message);

  const { count: rowsMaterialized, error: rowError } = await supabase
    .from("exhibitor_import_rows")
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

/** Clear orphaned import processing when a prior attempt died mid-flight (e.g. serverless timeout). */
async function recoverStaleImportProcessingPhase(
  batchId: string,
  batch: BatchRow,
): Promise<boolean> {
  if (!isStaleImportProcessingPhaseClaim(batch)) {
    return false;
  }

  const supabase = createAdminClient();
  const phase = batch.processing_phase;

  // Company materialization should not leave draft links behind; if any exist,
  // do not auto-clear a stale materializing_companies claim.
  if (phase === "materializing_companies") {
    const { count, error: countError } = await supabase
      .from("exhibitor_import_draft_links")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId);

    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      return false;
    }
  }

  // importing_to_draft may legitimately have partial draft links after a timeout;
  // allow stale recovery so chunked draft-link materialization can resume.
  if (!phase) {
    return false;
  }

  const { data, error } = await supabase
    .from("exhibitor_import_batches")
    .update({ processing_phase: null, updated_at: new Date().toISOString() })
    .eq("id", batchId)
    .eq("status", "review")
    .eq("processing_phase", phase)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
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
    .from("exhibitor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (totalError) throw new Error(totalError.message);

  const { count: linked, error: linkedError } = await supabase
    .from("exhibitor_import_rows")
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
    done: true,
    next_cursor: null,
  };
}

async function executeRunMaterializeCompaniesChunk(
  batchId: string,
  actorId: string,
  options: { cursor?: number; limit?: number } = {},
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
    throw new ExhibitorImportHttpError(
      409,
      "Import-to-draft is already in progress.",
    );
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (batch.processing_phase !== "materializing_companies") {
    const { data: initialClaim, error: claimError } = await supabase
      .from("exhibitor_import_batches")
      .update({ processing_phase: "materializing_companies", updated_at: now })
      .eq("id", batchId)
      .eq("status", "review")
      .is("processing_phase", null)
      .select("id")
      .maybeSingle();

    if (claimError) throw new Error(claimError.message);
    let claimed = initialClaim;

    if (!claimed) {
      batch = await getBatchRow(batchId);
      if (
        batch.processing_phase === "materializing_companies" &&
        (await recoverStaleImportProcessingPhase(batchId, batch))
      ) {
        const reclaim = await supabase
          .from("exhibitor_import_batches")
          .update({
            processing_phase: "materializing_companies",
            updated_at: new Date().toISOString(),
          })
          .eq("id", batchId)
          .eq("status", "review")
          .is("processing_phase", null)
          .select("id")
          .maybeSingle();
        if (reclaim.error) throw new Error(reclaim.error.message);
        claimed = reclaim.data;
      }
      if (!claimed && batch.processing_phase !== "materializing_companies") {
        if (batch.processing_phase === "importing_to_draft") {
          if (await isCompanyMaterializationComplete(batchId)) {
            return buildCompletedCompanyMaterializationResult(batchId);
          }
          throw new ExhibitorImportHttpError(
            409,
            "Import-to-draft is already in progress.",
          );
        }
        throw new ExhibitorImportHttpError(
          409,
          "Company materialization could not start. Refresh the page and try again.",
          { status: batch.status, processing_phase: batch.processing_phase },
        );
      }
    }
  } else {
    const { error: touchError } = await supabase
      .from("exhibitor_import_batches")
      .update({ updated_at: now })
      .eq("id", batchId)
      .eq("status", "review")
      .eq("processing_phase", "materializing_companies");
    if (touchError) throw new Error(touchError.message);
  }

  const result = await materializeCompaniesChunk(batchId, options);

  if (result.done) {
    const { error: clearError } = await supabase
      .from("exhibitor_import_batches")
      .update({ processing_phase: null, updated_at: new Date().toISOString() })
      .eq("id", batchId)
      .eq("status", "review")
      .eq("processing_phase", "materializing_companies");
    if (clearError) throw new Error(clearError.message);
  }

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
  options: { cursor?: number; limit?: number } = {},
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
    .from("exhibitor_import_rows")
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
    .from("exhibitor_import_rows")
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
    done: true,
    next_cursor: null,
  };
}

async function assertCompanyMaterializationComplete(batchId: string): Promise<void> {
  if (!(await isCompanyMaterializationComplete(batchId))) {
    throw new ExhibitorImportHttpError(
      409,
      "Company materialization must finish before creating draft links.",
    );
  }
}

async function assertAllResolvedRowsLinked(batchId: string): Promise<void> {
  const supabase = createAdminClient();
  const { count: totalResolved, error: totalError } = await supabase
    .from("exhibitor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (totalError) throw new Error(totalError.message);

  const { count: linked, error: linkedError } = await supabase
    .from("exhibitor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .not("draft_link_id", "is", null);

  if (linkedError) throw new Error(linkedError.message);

  const resolvedTotal = totalResolved ?? 0;
  const linkedTotal = linked ?? 0;

  if (resolvedTotal === 0) {
    throw new ExhibitorImportHttpError(422, "No resolved rows to import to draft.");
  }

  if (linkedTotal < resolvedTotal) {
    throw new ExhibitorImportHttpError(
      422,
      "Draft-link materialization is incomplete. Finish creating draft links before finalizing.",
      { resolved_rows: resolvedTotal, rows_with_draft_link: linkedTotal },
    );
  }
}

function assertImportToDraftNotBlockedByProcessingPhase(batch: BatchRow): void {
  if (batch.processing_phase === "materializing_companies") {
    throw new ExhibitorImportHttpError(
      409,
      "Company materialization is in progress. Wait for it to finish before import-to-draft.",
    );
  }
  if (batch.processing_phase === "importing_to_draft") {
    throw new ExhibitorImportHttpError(
      409,
      "Draft-link materialization is in progress. Wait for it to finish before finalizing.",
    );
  }
}

async function executeRunMaterializeDraftLinksChunk(
  batchId: string,
  actorId: string,
  options: { cursor?: number; limit?: number } = {},
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
    throw new ExhibitorImportHttpError(
      409,
      "Company materialization is in progress. Wait for it to finish before creating draft links.",
    );
  }

  const rows = await loadImportRows(batchId);
  assertImportToDraftGuards(rows);
  await assertCompanyMaterializationComplete(batchId);

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (batch.processing_phase !== "importing_to_draft") {
    const { data: initialClaim, error: claimError } = await supabase
      .from("exhibitor_import_batches")
      .update({ processing_phase: "importing_to_draft", updated_at: now })
      .eq("id", batchId)
      .eq("status", "review")
      .is("processing_phase", null)
      .select("id")
      .maybeSingle();

    if (claimError) throw new Error(claimError.message);
    let claimed = initialClaim;

    if (!claimed) {
      batch = await getBatchRow(batchId);
      if (
        batch.processing_phase === "importing_to_draft" &&
        (await recoverStaleImportProcessingPhase(batchId, batch))
      ) {
        const reclaim = await supabase
          .from("exhibitor_import_batches")
          .update({
            processing_phase: "importing_to_draft",
            updated_at: new Date().toISOString(),
          })
          .eq("id", batchId)
          .eq("status", "review")
          .is("processing_phase", null)
          .select("id")
          .maybeSingle();
        if (reclaim.error) throw new Error(reclaim.error.message);
        claimed = reclaim.data;
      }
      if (!claimed && batch.processing_phase !== "importing_to_draft") {
        if (batch.processing_phase === "materializing_companies") {
          throw new ExhibitorImportHttpError(
            409,
            "Company materialization is in progress. Wait for it to finish before creating draft links.",
          );
        }
        throw new ExhibitorImportHttpError(
          409,
          "Draft-link materialization could not start. Refresh the page and try again.",
          { status: batch.status, processing_phase: batch.processing_phase },
        );
      }
    }
  } else {
    const { error: touchError } = await supabase
      .from("exhibitor_import_batches")
      .update({ updated_at: now })
      .eq("id", batchId)
      .eq("status", "review")
      .eq("processing_phase", "importing_to_draft");
    if (touchError) throw new Error(touchError.message);
  }

  const result = await materializeDraftLinksChunk(
    batchId,
    String(batch.event_edition_id),
    options,
  );

  if (result.done) {
    const { error: clearError } = await supabase
      .from("exhibitor_import_batches")
      .update({ processing_phase: null, updated_at: new Date().toISOString() })
      .eq("id", batchId)
      .eq("status", "review")
      .eq("processing_phase", "importing_to_draft");
    if (clearError) throw new Error(clearError.message);
  }

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
  options: { cursor?: number; limit?: number } = {},
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

  const supabase = createAdminClient();
  const result = await summarizeImportToDraftFromDb(batchId);

  const { data: finalized, error: updateError } = await supabase
    .from("exhibitor_import_batches")
    .update({
      status: "draft",
      processing_phase: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .eq("status", "review")
    .select("id")
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);

  if (!finalized) {
    batch = await getBatchRow(batchId);
    if (batch.status === "draft") {
      return resolveIdempotentImportToDraftResult(batchId);
    }
    throw new ExhibitorImportHttpError(
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
    .from("exhibitor_import_draft_links")
    .select(
      "id, batch_id, event_edition_id, company_id, tier_rank, tier_label, source_import_row_id, excluded_from_publish, created_at, updated_at, companies(id, name, slug, domain)",
    )
    .eq("batch_id", batchId)
    .order("tier_rank", { ascending: true });

  if (error) throw new Error(error.message);

  const { data: live, error: liveError } = await supabase
    .from("event_exhibitors")
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
      throw new ExhibitorImportHttpError(400, "tier_rank must be an integer >= 1.");
    }
    patch.tier_rank = input.tier_rank;
  }
  if (input.excluded_from_publish !== undefined) {
    patch.excluded_from_publish = input.excluded_from_publish;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("exhibitor_import_draft_links")
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
    .from("exhibitor_import_batches")
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
    throw new ExhibitorImportHttpError(422, "Review must be acknowledged before publish.");
  }

  const storagePath =
    typeof batch.source_file_storage_path === "string"
      ? batch.source_file_storage_path
      : null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("exhibitor_import_publish_batch", {
    p_batch_id: batchId,
    p_published_by: actorId,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("invalid_batch_status")) {
      throw new ExhibitorImportHttpError(409, "Batch is not in draft status.");
    }
    if (msg.includes("review_not_acknowledged")) {
      throw new ExhibitorImportHttpError(422, "Review not acknowledged.");
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
      `[exhibitor-import] publish cleanup failed for batch ${batchId}:`,
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
    .from("exhibitor_import_draft_links")
    .delete()
    .eq("batch_id", batchId);
  if (draftLinksError) throw new Error(draftLinksError.message);

  const { error: duplicateClearError } = await supabase
    .from("exhibitor_import_rows")
    .update({ duplicate_of_row_id: null })
    .eq("batch_id", batchId);
  if (duplicateClearError) throw new Error(duplicateClearError.message);

  const { error: deleteBatchError } = await supabase
    .from("exhibitor_import_batches")
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
    .from("exhibitor_import_admin_action_logs")
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
    .from("exhibitor_import_rows")
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
