import { createAdminClient } from "@/src/lib/supabase/admin";
import { normalizeDomain } from "@/src/lib/domain/normalizeDomain";

import type {
  ColumnMapping,
  DraftDiffSummary,
  PublishResult,
  RowSummary,
  SponsorImportBatchStatus,
  SponsorImportDecisionType,
} from "../types";
import { appendActionLog } from "./actionLog";
import {
  assertBatchNotTerminal,
  assertBatchStatus,
  assertImportToDraftGuards,
  summarizeRows,
  type BatchRow,
  type ImportRowRecord,
} from "./batchGuards";
import { SponsorImportHttpError } from "./errors";
import { loadMatchContext, matchRow } from "./matchRows";
import { materializeDraftLinks } from "./materializeDraft";
import {
  detectSourceFormat,
  guessColumnMapping,
  parseWithColumnMapping,
  readSpreadsheetHeaders,
} from "./parseSpreadsheet";
import { SPONSOR_IMPORT_BUCKET, SPONSOR_IMPORT_MAX_ROWS } from "../types";
import { uploadSourceFile } from "./storage";
import { assignDuplicateClusters, validateRow } from "./validateRows";

const BATCH_SELECT =
  "id, event_edition_id, status, processing_phase, source_filename, source_file_storage_path, source_file_format, source_sheet_name, source_row_count, source_file_checksum, column_mapping, created_by, published_by, discarded_by, review_acknowledged_by, published_at, discarded_at, review_acknowledged_at, discard_reason, created_at, updated_at";

const ROW_SELECT =
  "id, batch_id, excel_row_number, raw_company_name, raw_website, raw_tier_rank, normalized_company_name, normalized_website, normalized_domain, proposed_slug, mapped_tier_rank, status, validation_issues, has_blocking_validation, match_method, match_confidence, proposed_company_id, conflict_type, decision_type, decision_source, resolved_company_id, decision_by, decision_at, decision_notes, duplicate_cluster_key, duplicate_role, duplicate_of_row_id, duplicate_resolution, already_on_live_sponsor_id, already_on_live_tier_rank, intended_link_action, draft_link_id, import_error, created_at, updated_at";

function parseColumnMapping(raw: unknown): ColumnMapping {
  if (!raw || typeof raw !== "object") {
    throw new SponsorImportHttpError(400, "column_mapping must be an object.");
  }
  const o = raw as Record<string, unknown>;
  const company_name = typeof o.company_name === "string" ? o.company_name.trim() : "";
  const website = typeof o.website === "string" ? o.website.trim() : "";
  const tier_rank = typeof o.tier_rank === "string" ? o.tier_rank.trim() : "";
  if (!company_name || !website || !tier_rank) {
    throw new SponsorImportHttpError(
      400,
      "column_mapping requires company_name, website, and tier_rank.",
    );
  }
  const notes = typeof o.notes === "string" ? o.notes.trim() : undefined;
  return { company_name, website, tier_rank, ...(notes ? { notes } : {}) };
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
      "id, status, has_blocking_validation, duplicate_role, duplicate_resolution",
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
  const batch = await getBatchRow(batchId);
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
    .from(SPONSOR_IMPORT_BUCKET)
    .download(batch.source_file_storage_path as string);

  if (downloadError || !fileData) {
    throw new Error(downloadError?.message ?? "Failed to download source file.");
  }

  const buffer = await fileData.arrayBuffer();
  const { rows, sheetName } = parseWithColumnMapping(buffer, mapping);

  await supabase.from("sponsor_import_rows").delete().eq("batch_id", batchId);

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("sponsor_import_rows").insert(
      rows.map((r) => ({
        batch_id: batchId,
        excel_row_number: r.excelRowNumber,
        raw_company_name: r.rawCompanyName,
        raw_website: r.rawWebsite,
        raw_tier_rank: r.rawTierRank,
        status: "needs_review",
        validation_issues: [],
        has_blocking_validation: false,
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  const nextStatus: SponsorImportBatchStatus = transitionToReview ? "review" : batch.status;

  const { data: updated, error: updateError } = await supabase
    .from("sponsor_import_batches")
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
    .from("sponsor_import_batches")
    .update({ processing_phase: "validating", updated_at: new Date().toISOString() })
    .eq("id", batchId);

  const { data: rawRows, error } = await supabase
    .from("sponsor_import_rows")
    .select(
      "id, excel_row_number, raw_company_name, raw_website, raw_tier_rank, status",
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
        status: String(r.status),
      });
      return { ...v, id: String(r.id), excel_row_number: Number(r.excel_row_number), status: String(r.status) };
    }),
  );

  for (const row of validated) {
    const prior = rawRows?.find((x) => String(x.id) === row.id);
    const priorStatus = prior ? String(prior.status) : "needs_review";
    const nextStatus =
      row.has_blocking_validation || priorStatus === "excluded"
        ? priorStatus === "excluded"
          ? "excluded"
          : "needs_review"
        : priorStatus;

    const { error: rowError } = await supabase
      .from("sponsor_import_rows")
      .update({
        normalized_company_name: row.normalized_company_name,
        normalized_website: row.normalized_website,
        normalized_domain: row.normalized_domain,
        proposed_slug: row.proposed_slug,
        mapped_tier_rank: row.mapped_tier_rank,
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
    .from("sponsor_import_batches")
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
    .from("sponsor_import_batches")
    .update({ processing_phase: "matching", updated_at: new Date().toISOString() })
    .eq("id", batchId);

  const { companiesByDomain, liveByCompanyId } = await loadMatchContext(
    String(batch.event_edition_id),
  );

  const { data: rows, error } = await supabase
    .from("sponsor_import_rows")
    .select(
      "id, status, normalized_domain, normalized_company_name, mapped_tier_rank, has_blocking_validation",
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
        normalized_company_name: row.normalized_company_name as string | null,
        mapped_tier_rank: row.mapped_tier_rank as number | null,
        has_blocking_validation: Boolean(row.has_blocking_validation),
      },
      String(batch.event_edition_id),
      companiesByDomain,
      liveByCompanyId,
    );

    const { error: updateError } = await supabase
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
      .eq("id", row.id);

    if (updateError) throw new Error(updateError.message);
    matched += 1;
  }

  await supabase
    .from("sponsor_import_batches")
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
  const now = new Date().toISOString();

  const { data: rows, error: selectError } = await supabase
    .from("sponsor_import_rows")
    .select("id")
    .eq("batch_id", batchId)
    .eq("status", "auto_ready")
    .eq("match_method", "domain")
    .eq("match_confidence", "high");

  if (selectError) throw new Error(selectError.message);

  const { data: autoRows, error: fetchError } = await supabase
    .from("sponsor_import_rows")
    .select("id, proposed_company_id")
    .eq("batch_id", batchId)
    .eq("status", "auto_ready")
    .eq("match_method", "domain")
    .eq("match_confidence", "high");

  if (fetchError) throw new Error(fetchError.message);

  let accepted = 0;
  for (const row of autoRows ?? []) {
    const proposed = row.proposed_company_id;
    if (!proposed) continue;
    const { error } = await supabase
      .from("sponsor_import_rows")
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
    if (error) throw new Error(error.message);
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
  normalized_website: string | null;
  raw_website: string | null;
  normalized_domain: string | null;
  duplicate_role: string | null;
};

function resolveServerRowDomain(row: BulkRowDecisionRow): string {
  const fromNormalized = (row.normalized_domain ?? "").trim();
  if (fromNormalized !== "") return fromNormalized;
  const website = (row.normalized_website ?? row.raw_website ?? "").trim();
  if (website === "") return "";
  return normalizeDomain(website).trim();
}

function isServerEligibleForBulkCreateNew(row: BulkRowDecisionRow): boolean {
  if (row.status === "resolved" || row.status === "excluded") return false;
  if (row.has_blocking_validation === true) return false;
  const name = (row.normalized_company_name ?? row.raw_company_name ?? "").trim();
  const domain = resolveServerRowDomain(row);
  return name !== "" && domain !== "";
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

  return { rows: data ?? [], total: count ?? 0, page, pageSize, summary };
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
  return data;
}

export async function patchRowDecision(
  batchId: string,
  rowId: string,
  actorId: string,
  input: {
    decision_type: SponsorImportDecisionType;
    resolved_company_id?: string | null;
    decision_notes?: string | null;
    duplicate_resolution?: "kept" | "excluded" | "pending" | null;
  },
) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["review"]);

  const supabase = createAdminClient();
  const { data: row, error: rowError } = await supabase
    .from("sponsor_import_rows")
    .select("id, proposed_company_id, duplicate_role")
    .eq("batch_id", batchId)
    .eq("id", rowId)
    .maybeSingle();

  if (rowError) throw new Error(rowError.message);
  if (!row) throw new SponsorImportHttpError(404, "Row not found.");

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

  const { data: updated, error: updateError } = await supabase
    .from("sponsor_import_rows")
    .update(patch)
    .eq("id", rowId)
    .select(ROW_SELECT)
    .single();

  if (updateError) throw new Error(updateError.message);
  return updated;
}

export async function importBatchToDraft(batchId: string, actorId: string) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["review"]);

  const rows = await loadImportRows(batchId);
  assertImportToDraftGuards(rows);

  const supabase = createAdminClient();
  await supabase
    .from("sponsor_import_batches")
    .update({ processing_phase: "importing_to_draft", updated_at: new Date().toISOString() })
    .eq("id", batchId);

  const { data: resolvedRows, error } = await supabase
    .from("sponsor_import_rows")
    .select(
      "id, excel_row_number, decision_type, resolved_company_id, proposed_company_id, normalized_company_name, normalized_website, proposed_slug, mapped_tier_rank",
    )
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (error) throw new Error(error.message);

  try {
    const result = await materializeDraftLinks(
      batchId,
      String(batch.event_edition_id),
      (resolvedRows ?? []).map((r) => ({
        id: String(r.id),
        excel_row_number: Number(r.excel_row_number),
        decision_type: r.decision_type as string | null,
        resolved_company_id: r.resolved_company_id as string | null,
        proposed_company_id: r.proposed_company_id as string | null,
        normalized_company_name: r.normalized_company_name as string | null,
        normalized_website: r.normalized_website as string | null,
        proposed_slug: r.proposed_slug as string | null,
        mapped_tier_rank: r.mapped_tier_rank as number | null,
      })),
    );

    await supabase
      .from("sponsor_import_batches")
      .update({
        status: "draft",
        processing_phase: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    await appendActionLog({
      batchId,
      actorId,
      actionType: "import_to_draft",
      payload: result,
      affectedCount: result.rows_materialized,
    });

    return result;
  } catch (e) {
    await supabase
      .from("sponsor_import_batches")
      .update({ processing_phase: null, updated_at: new Date().toISOString() })
      .eq("id", batchId);
    throw e;
  }
}

export async function listDraftLinks(batchId: string) {
  const batch = await getBatchRow(batchId);
  const supabase = createAdminClient();

  const { data: links, error } = await supabase
    .from("sponsor_import_draft_links")
    .select(
      "id, batch_id, event_edition_id, company_id, tier_rank, source_import_row_id, excluded_from_publish, created_at, updated_at, companies(id, name, slug, domain)",
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
  await appendActionLog({
    batchId,
    actorId,
    actionType: "publish",
    payload: result,
    affectedCount:
      (result.new_count ?? 0) +
      (result.tier_updated_count ?? 0) +
      (result.unchanged_count ?? 0),
  });

  return result;
}

export async function discardBatch(
  batchId: string,
  actorId: string,
  discardReason?: string | null,
) {
  const batch = await getBatchRow(batchId);
  assertBatchStatus(batch, ["uploaded", "review", "draft"]);

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  await supabase
    .from("sponsor_import_draft_links")
    .delete()
    .eq("batch_id", batchId);

  const { data, error } = await supabase
    .from("sponsor_import_batches")
    .update({
      status: "discarded",
      discarded_by: actorId,
      discarded_at: now,
      discard_reason: discardReason ?? null,
      processing_phase: null,
      updated_at: now,
    })
    .eq("id", batchId)
    .select(BATCH_SELECT)
    .single();

  if (error) throw new Error(error.message);

  await appendActionLog({
    batchId,
    actorId,
    actionType: "discard",
    payload: discardReason ? { reason: discardReason } : null,
  });

  return data;
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
      "excel_row_number, raw_company_name, normalized_domain, mapped_tier_rank, status, decision_type, resolved_company_id, import_error, draft_link_id",
    )
    .eq("batch_id", batchId)
    .order("excel_row_number", { ascending: true });

  if (error) throw new Error(error.message);

  const header = [
    "excel_row_number",
    "company_name",
    "domain",
    "tier_rank",
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
