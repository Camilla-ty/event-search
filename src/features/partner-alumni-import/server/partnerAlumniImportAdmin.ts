import { createAdminClient } from "@/src/lib/supabase/admin";

import { assertVersionBelongsToSeries } from "@/src/features/partner-alumni/server/partnerAlumniAdmin";

import type {
  ColumnMapping,
  PartnerAlumniImportBatchStatus,
  PartnerAlumniImportDecisionType,
  PartnerAlumniImportMatchMethod,
  RowSummary,
} from "../types";
import { PARTNER_ALUMNI_IMPORT_BUCKET, PARTNER_ALUMNI_IMPORT_MAX_ROWS } from "../types";
import {
  summarizeMatchMethods,
  summarizeMaterializePreview,
  type ImportSummaryRow,
} from "./importSummary";
import { appendActionLog } from "./actionLog";
import {
  assertBatchStatus,
  summarizeRows,
  type BatchRow,
  type ImportRowRecord,
} from "./batchGuards";
import { enrichImportRowsWithProposedCompanies } from "./enrichImportRows";
import { PartnerAlumniImportHttpError } from "./errors";
import { AUTO_READY_MATCH_METHODS, loadMatchContext, matchRow } from "./matchRows";
import {
  detectSourceFormat,
  parseWithColumnMapping,
  readSpreadsheetHeaders,
  resolveUploadColumnMapping,
  toColumnMapping,
} from "./parseSpreadsheet";
import { deleteSourceFile, uploadSourceFile } from "./storage";
import { assignDuplicateClusters, validateRow } from "./validateRows";

const BATCH_SELECT =
  "id, event_series_id, event_partner_alumni_version_id, status, processing_phase, source_filename, source_file_storage_path, source_file_format, source_sheet_name, source_row_count, source_file_checksum, column_mapping, created_by, imported_by, discarded_by, review_acknowledged_by, create_new_acknowledged_by, review_acknowledged_at, create_new_acknowledged_at, create_new_acknowledged_count, imported_at, discarded_at, discard_reason, created_at, updated_at";

const ROW_SELECT =
  "id, batch_id, excel_row_number, raw_company_name, raw_website, raw_display_order, raw_notes, normalized_company_name, normalized_website, normalized_domain, proposed_slug, mapped_display_order, status, validation_issues, has_blocking_validation, match_method, match_confidence, proposed_company_id, conflict_type, decision_type, decision_source, resolved_company_id, decision_by, decision_at, decision_notes, duplicate_cluster_key, duplicate_role, duplicate_of_row_id, duplicate_resolution, already_on_version_member_id, intended_member_action, version_member_id, import_error, created_at, updated_at";

export type ImportScope = {
  seriesId: string;
  versionId: string;
};

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

export { toColumnMapping as parseColumnMapping };

function resolveMatchMethodOnDecision(
  decisionType: PartnerAlumniImportDecisionType,
  existingMatchMethod: string | null,
): PartnerAlumniImportMatchMethod | null {
  if (decisionType === "create_new") return "create_new";
  if (decisionType === "choose_different") return "manual";
  if (decisionType === "exclude") return null;
  if (decisionType === "use_matched") {
    if (
      existingMatchMethod === "domain" ||
      existingMatchMethod === "alias" ||
      existingMatchMethod === "exact_name" ||
      existingMatchMethod === "manual"
    ) {
      return existingMatchMethod;
    }
    return "exact_name";
  }
  return null;
}

async function getBatchRow(batchId: string): Promise<BatchRow & Record<string, unknown>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_alumni_import_batches")
    .select(BATCH_SELECT)
    .eq("id", batchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new PartnerAlumniImportHttpError(404, "Batch not found.");
  return data as BatchRow & Record<string, unknown>;
}

export async function getBatchRowScoped(
  batchId: string,
  scope: ImportScope,
): Promise<BatchRow & Record<string, unknown>> {
  const batch = await getBatchRow(batchId);
  if (
    String(batch.event_series_id) !== scope.seriesId ||
    String(batch.event_partner_alumni_version_id) !== scope.versionId
  ) {
    throw new PartnerAlumniImportHttpError(404, "Batch not found.");
  }
  return batch;
}

async function loadImportRows(batchId: string): Promise<ImportRowRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_alumni_import_rows")
    .select(
      "id, status, has_blocking_validation, duplicate_cluster_key, duplicate_role, duplicate_resolution",
    )
    .eq("batch_id", batchId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ImportRowRecord[];
}

async function loadImportSummaryRows(batchId: string): Promise<ImportSummaryRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_alumni_import_rows")
    .select("status, match_method, decision_type, intended_member_action")
    .eq("batch_id", batchId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ImportSummaryRow[];
}

function buildImportSummaries(rows: ImportSummaryRow[]) {
  return {
    match_method_summary: summarizeMatchMethods(rows),
    materialize_preview: summarizeMaterializePreview(rows),
  };
}

function rowInsertPayload(batchId: string, rows: ReturnType<typeof parseWithColumnMapping>["rows"]) {
  return rows.map((r) => ({
    batch_id: batchId,
    excel_row_number: r.excelRowNumber,
    raw_company_name: r.rawCompanyName,
    raw_website: r.rawWebsite,
    raw_display_order: r.rawDisplayOrder,
    raw_notes: r.rawNotes,
    status: "needs_review" as const,
    validation_issues: [],
    has_blocking_validation: false,
  }));
}

export async function listBatchesAdmin(
  scope: ImportScope,
  filters: {
    status?: PartnerAlumniImportBatchStatus;
    limit?: number;
    offset?: number;
  },
) {
  await assertVersionBelongsToSeries(scope.seriesId, scope.versionId);

  const supabase = createAdminClient();
  let query = supabase
    .from("partner_alumni_import_batches")
    .select(BATCH_SELECT, { count: "exact" })
    .eq("event_series_id", scope.seriesId)
    .eq("event_partner_alumni_version_id", scope.versionId)
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { batches: data ?? [], total: count ?? 0 };
}

async function getBatchSpreadsheetPreview(batch: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(PARTNER_ALUMNI_IMPORT_BUCKET)
    .download(String(batch.source_file_storage_path));

  if (downloadError || !fileData) {
    return { headers: [] as string[], headerRowIndex: 0, previewRows: [] as string[][] };
  }

  const buffer = await fileData.arrayBuffer();
  const mapping = batch.column_mapping as ColumnMapping | null;
  return readSpreadsheetHeaders(buffer, mapping?.header_row_index);
}

export async function getBatchAdmin(batchId: string, scope: ImportScope) {
  const batch = await getBatchRowScoped(batchId, scope);
  const [rows, summaryRows, preview] = await Promise.all([
    loadImportRows(batchId),
    loadImportSummaryRows(batchId),
    getBatchSpreadsheetPreview(batch),
  ]);
  const summary = summarizeRows(rows);
  const pendingCreateNewCount = await countPendingCreateNewRows(batchId);
  const importSummaries = buildImportSummaries(summaryRows);

  return {
    batch,
    summary,
    ...importSummaries,
    headers: preview.headers,
    headerRowIndex: preview.headerRowIndex,
    previewRows: preview.previewRows,
    pending_create_new_count: pendingCreateNewCount,
  };
}

async function countPendingCreateNewRows(batchId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("partner_alumni_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("decision_type", "create_new")
    .eq("status", "resolved");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getActiveBatchForVersion(scope: ImportScope) {
  await assertVersionBelongsToSeries(scope.seriesId, scope.versionId);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_alumni_import_batches")
    .select(BATCH_SELECT)
    .eq("event_series_id", scope.seriesId)
    .eq("event_partner_alumni_version_id", scope.versionId)
    .in("status", ["uploaded", "review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createBatchFromUpload(input: {
  scope: ImportScope;
  actorId: string;
  filename: string;
  mimeType: string;
  fileBytes: Uint8Array;
  columnMapping?: ColumnMapping | null;
}) {
  await assertVersionBelongsToSeries(input.scope.seriesId, input.scope.versionId);

  const format = detectSourceFormat(input.filename, input.mimeType);
  const buffer = input.fileBytes.buffer.slice(
    input.fileBytes.byteOffset,
    input.fileBytes.byteOffset + input.fileBytes.byteLength,
  ) as ArrayBuffer;

  let mapping = input.columnMapping ?? resolveUploadColumnMapping(buffer);

  const { rows, sheetName, headerRowIndex } = parseWithColumnMapping(buffer, mapping);

  const batchId = crypto.randomUUID();
  const storagePath = await uploadSourceFile(
    batchId,
    input.filename,
    input.fileBytes,
    input.mimeType || "application/octet-stream",
  );

  const supabase = createAdminClient();
  const { data: batch, error: batchError } = await supabase
    .from("partner_alumni_import_batches")
    .insert({
      id: batchId,
      event_series_id: input.scope.seriesId,
      event_partner_alumni_version_id: input.scope.versionId,
      status: "uploaded",
      source_filename: input.filename,
      source_file_storage_path: storagePath,
      source_file_format: format,
      source_sheet_name: sheetName,
      source_row_count: rows.length,
      column_mapping: { ...mapping, header_row_index: headerRowIndex },
      created_by: input.actorId,
    })
    .select(BATCH_SELECT)
    .single();

  if (batchError) throw new Error(batchError.message);

  const { error: rowsError } = await supabase
    .from("partner_alumni_import_rows")
    .insert(rowInsertPayload(batchId, rows));
  if (rowsError) {
    await supabase.from("partner_alumni_import_batches").delete().eq("id", batchId);
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
  scope: ImportScope,
  actorId: string,
  mapping: ColumnMapping,
  transitionToReview: boolean,
) {
  const batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["uploaded", "review"]);

  const supabase = createAdminClient();
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(PARTNER_ALUMNI_IMPORT_BUCKET)
    .download(String(batch.source_file_storage_path));

  if (downloadError || !fileData) {
    throw new Error(downloadError?.message ?? "Failed to download source file.");
  }

  const buffer = await fileData.arrayBuffer();
  const { rows, sheetName, headerRowIndex } = parseWithColumnMapping(buffer, mapping);

  await supabase.from("partner_alumni_import_rows").delete().eq("batch_id", batchId);

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("partner_alumni_import_rows")
      .insert(rowInsertPayload(batchId, rows));
    if (insertError) throw new Error(insertError.message);
  }

  const nextStatus: PartnerAlumniImportBatchStatus = transitionToReview ? "review" : batch.status;

  const { data: updated, error: updateError } = await supabase
    .from("partner_alumni_import_batches")
    .update({
      column_mapping: { ...mapping, header_row_index: headerRowIndex },
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
    payload: { mapping: { ...mapping, header_row_index: headerRowIndex }, row_count: rows.length },
    affectedCount: rows.length,
  });

  return updated;
}

export async function runBatchValidation(batchId: string, scope: ImportScope, actorId: string) {
  const batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["uploaded", "review"]);

  const supabase = createAdminClient();
  await supabase
    .from("partner_alumni_import_batches")
    .update({ processing_phase: "validating", updated_at: new Date().toISOString() })
    .eq("id", batchId);

  const { data: rawRows, error } = await supabase
    .from("partner_alumni_import_rows")
    .select(
      "id, excel_row_number, raw_company_name, raw_website, raw_display_order, status",
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
        raw_display_order: r.raw_display_order as string | null,
        status: String(r.status),
      });
      return {
        ...v,
        id: String(r.id),
        excel_row_number: Number(r.excel_row_number),
        status: String(r.status),
      };
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
      .from("partner_alumni_import_rows")
      .update({
        normalized_company_name: row.normalized_company_name,
        normalized_website: row.normalized_website,
        normalized_domain: row.normalized_domain,
        proposed_slug: row.proposed_slug,
        mapped_display_order: row.mapped_display_order,
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
    .from("partner_alumni_import_batches")
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

export async function runBatchMatching(batchId: string, scope: ImportScope, actorId: string) {
  const batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["review"]);

  const supabase = createAdminClient();
  await supabase
    .from("partner_alumni_import_batches")
    .update({ processing_phase: "matching", updated_at: new Date().toISOString() })
    .eq("id", batchId);

  const { matchContext, memberByCompanyId } = await loadMatchContext(scope.versionId);

  const { data: rows, error } = await supabase
    .from("partner_alumni_import_rows")
    .select(
      "id, status, normalized_domain, normalized_website, normalized_company_name, mapped_display_order, has_blocking_validation",
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
        mapped_display_order: row.mapped_display_order as number | null,
        has_blocking_validation: Boolean(row.has_blocking_validation),
      },
      matchContext,
      memberByCompanyId,
    );

    const { error: updateError } = await supabase
      .from("partner_alumni_import_rows")
      .update({
        status: result.status,
        match_method: result.match_method,
        match_confidence: result.match_confidence,
        proposed_company_id: result.proposed_company_id,
        conflict_type: result.conflict_type,
        already_on_version_member_id: result.already_on_version_member_id,
        intended_member_action: result.intended_member_action,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) throw new Error(updateError.message);
    matched += 1;
  }

  await supabase
    .from("partner_alumni_import_batches")
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

export async function bulkAcceptDomainMatches(
  batchId: string,
  scope: ImportScope,
  actorId: string,
) {
  const batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["review"]);

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: autoRows, error } = await supabase
    .from("partner_alumni_import_rows")
    .select("id, proposed_company_id, match_method")
    .eq("batch_id", batchId)
    .eq("status", "auto_ready")
    .eq("match_confidence", "high")
    .in("match_method", [...AUTO_READY_MATCH_METHODS]);

  if (error) throw new Error(error.message);

  let accepted = 0;
  for (const row of autoRows ?? []) {
    const proposed = row.proposed_company_id;
    if (!proposed) continue;

    const { error: updateError } = await supabase
      .from("partner_alumni_import_rows")
      .update({
        status: "resolved",
        decision_type: "use_matched",
        decision_source: "bulk_action",
        resolved_company_id: proposed,
        decision_by: actorId,
        decision_at: now,
        updated_at: now,
      })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
    accepted += 1;
  }

  await appendActionLog({
    batchId,
    actorId,
    actionType: "bulk_accept_domain_matches",
    affectedCount: accepted,
  });

  return { accepted_count: accepted };
}

type BulkRowDecisionRow = {
  id: string;
  status: string;
  has_blocking_validation: boolean;
  normalized_company_name: string | null;
  raw_company_name: string | null;
  duplicate_role: string | null;
};

function isEligibleForBulkCreateNew(row: BulkRowDecisionRow): boolean {
  if (row.status === "resolved" || row.status === "excluded") return false;
  if (row.has_blocking_validation) return false;
  const name = (row.normalized_company_name ?? row.raw_company_name ?? "").trim();
  return name !== "";
}

export async function bulkApplyRowDecisions(
  batchId: string,
  scope: ImportScope,
  actorId: string,
  input: {
    decision_type: "create_new" | "exclude";
    row_ids: string[];
  },
) {
  const batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["review"]);

  const uniqueIds = Array.from(new Set(input.row_ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    throw new PartnerAlumniImportHttpError(400, "row_ids must not be empty.");
  }
  if (uniqueIds.length > PARTNER_ALUMNI_IMPORT_MAX_ROWS) {
    throw new PartnerAlumniImportHttpError(
      400,
      `Maximum ${PARTNER_ALUMNI_IMPORT_MAX_ROWS} rows per bulk action.`,
    );
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("partner_alumni_import_rows")
    .select(
      "id, status, has_blocking_validation, normalized_company_name, raw_company_name, duplicate_role",
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
      if (!isEligibleForBulkCreateNew(row)) {
        skipped_count += 1;
        continue;
      }

      const patch: Record<string, unknown> = {
        status: "resolved",
        decision_type: "create_new",
        decision_source: "bulk_action",
        resolved_company_id: null,
        match_method: "create_new",
        decision_by: actorId,
        decision_at: now,
        updated_at: now,
      };
      if (row.duplicate_role === "duplicate") {
        patch.duplicate_resolution = "kept";
      }

      const { error: updateError } = await supabase
        .from("partner_alumni_import_rows")
        .update(patch)
        .eq("id", rowId);
      if (updateError) throw new Error(updateError.message);
      applied_count += 1;
      continue;
    }

    if (row.status === "resolved" || row.status === "excluded") {
      skipped_count += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("partner_alumni_import_rows")
      .update({
        status: "excluded",
        decision_type: "exclude",
        decision_source: "bulk_action",
        resolved_company_id: null,
        decision_by: actorId,
        decision_at: now,
        updated_at: now,
      })
      .eq("id", rowId);
    if (updateError) throw new Error(updateError.message);
    applied_count += 1;
  }

  return { applied_count, skipped_count };
}

export async function listBatchRows(
  batchId: string,
  scope: ImportScope,
  filters: {
    status?: string;
    hasBlockingValidation?: boolean;
    duplicateResolution?: string;
    duplicateClusterKey?: string;
    page?: number;
    pageSize?: number;
  },
) {
  await getBatchRowScoped(batchId, scope);
  const supabase = createAdminClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("partner_alumni_import_rows")
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
  const summaryRows = await loadImportSummaryRows(batchId);
  const summary: RowSummary = summarizeRows(allRows);
  const importSummaries = buildImportSummaries(summaryRows);
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

  return {
    rows,
    total: count ?? 0,
    page,
    pageSize,
    summary,
    ...importSummaries,
    pending_create_new_count: summaryRows.filter(
      (row) => row.status === "resolved" && row.decision_type === "create_new",
    ).length,
  };
}

export async function getBatchRowById(batchId: string, scope: ImportScope, rowId: string) {
  await getBatchRowScoped(batchId, scope);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_alumni_import_rows")
    .select(ROW_SELECT)
    .eq("batch_id", batchId)
    .eq("id", rowId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new PartnerAlumniImportHttpError(404, "Row not found.");
  const [row] = await enrichImportRowsWithProposedCompanies([data]);
  return row ?? data;
}

export async function patchRowDecision(
  batchId: string,
  scope: ImportScope,
  rowId: string,
  actorId: string,
  input: {
    decision_type: PartnerAlumniImportDecisionType;
    resolved_company_id?: string | null;
    decision_notes?: string | null;
    duplicate_resolution?: "kept" | "excluded" | "pending" | null;
  },
) {
  const batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["review"]);

  const supabase = createAdminClient();
  const { data: row, error: rowError } = await supabase
    .from("partner_alumni_import_rows")
    .select(
      "id, proposed_company_id, duplicate_role, duplicate_cluster_key, match_method",
    )
    .eq("batch_id", batchId)
    .eq("id", rowId)
    .maybeSingle();

  if (rowError) throw new Error(rowError.message);
  if (!row) throw new PartnerAlumniImportHttpError(404, "Row not found.");

  const now = new Date().toISOString();
  const existingMatchMethod =
    typeof row.match_method === "string" ? row.match_method : null;

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
    patch.match_method = null;
  } else if (input.decision_type === "use_matched") {
    const companyId = input.resolved_company_id ?? row.proposed_company_id;
    if (!companyId) {
      throw new PartnerAlumniImportHttpError(400, "No proposed company to use.");
    }
    patch.status = "resolved";
    patch.resolved_company_id = companyId;
    patch.match_method = resolveMatchMethodOnDecision("use_matched", existingMatchMethod);
  } else if (input.decision_type === "choose_different") {
    if (!input.resolved_company_id) {
      throw new PartnerAlumniImportHttpError(400, "resolved_company_id required.");
    }
    patch.status = "resolved";
    patch.resolved_company_id = input.resolved_company_id;
    patch.match_method = "manual";
  } else if (input.decision_type === "create_new") {
    patch.status = "resolved";
    patch.resolved_company_id = null;
    patch.match_method = "create_new";
  }

  const duplicateClusterKey =
    typeof row.duplicate_cluster_key === "string" ? row.duplicate_cluster_key.trim() : "";
  const resolvesDuplicateCluster =
    duplicateClusterKey !== "" &&
    input.duplicate_resolution === "kept" &&
    input.decision_type !== "exclude";

  if (resolvesDuplicateCluster) {
    const { data: clusterRows, error: clusterError } = await supabase
      .from("partner_alumni_import_rows")
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

    for (const item of patches) {
      const { error: updateError } = await supabase
        .from("partner_alumni_import_rows")
        .update(item.patch)
        .eq("id", item.id);
      if (updateError) throw new Error(updateError.message);
    }

    return getBatchRowById(batchId, scope, rowId);
  }

  const { error: updateError } = await supabase
    .from("partner_alumni_import_rows")
    .update(patch)
    .eq("id", rowId);
  if (updateError) throw new Error(updateError.message);

  return getBatchRowById(batchId, scope, rowId);
}

async function deleteImportBatchData(input: {
  batchId: string;
  storagePath?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const normalizedStoragePath = input.storagePath?.trim() ?? "";

  if (normalizedStoragePath) {
    await deleteSourceFile(normalizedStoragePath);
  }

  const { error: duplicateClearError } = await supabase
    .from("partner_alumni_import_rows")
    .update({ duplicate_of_row_id: null })
    .eq("batch_id", input.batchId);
  if (duplicateClearError) throw new Error(duplicateClearError.message);

  const { error: deleteBatchError } = await supabase
    .from("partner_alumni_import_batches")
    .delete()
    .eq("id", input.batchId);
  if (deleteBatchError) throw new Error(deleteBatchError.message);
}

export type DiscardBatchResult = {
  event_series_id: string;
  event_partner_alumni_version_id: string;
};

export async function discardBatch(
  batchId: string,
  scope: ImportScope,
): Promise<DiscardBatchResult> {
  const batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["uploaded", "review"]);

  await deleteImportBatchData({
    batchId,
    storagePath:
      typeof batch.source_file_storage_path === "string"
        ? batch.source_file_storage_path
        : null,
  });

  return {
    event_series_id: String(batch.event_series_id),
    event_partner_alumni_version_id: String(batch.event_partner_alumni_version_id),
  };
}

export async function listActionLogs(batchId: string, scope: ImportScope) {
  await getBatchRowScoped(batchId, scope);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_alumni_import_action_logs")
    .select("id, batch_id, actor_id, action_type, payload, affected_count, created_at")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
