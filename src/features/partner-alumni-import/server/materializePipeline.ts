import { createAdminClient } from "@/src/lib/supabase/admin";

import type { ImportCompletionSummary, MaterializeCompaniesChunkResult, MaterializeVersionMembersChunkResult } from "../types";
import { appendActionLog } from "./actionLog";
import {
  assertBatchStatus,
  assertMaterializeGuards,
  isStaleMaterializeProcessingPhaseClaim,
  type BatchRow,
  type ImportRowRecord,
} from "./batchGuards";
import { PartnerAlumniImportHttpError } from "./errors";
import {
  assertCreateNewRowsExplicit,
  countPendingCreateNewRowsDetailed,
  isPartnerAlumniCompanyMaterializationComplete,
  materializePartnerAlumniCompaniesChunk,
} from "./materializeCompanies";
import {
  isVersionMemberMaterializationComplete,
  materializeVersionMembersChunk,
} from "./materializeVersionMembers";
import {
  getBatchRowScoped,
  type ImportScope,
} from "./partnerAlumniImportAdmin";

const BATCH_SELECT =
  "id, event_series_id, event_partner_alumni_version_id, status, processing_phase, source_filename, source_file_storage_path, source_file_format, source_sheet_name, source_row_count, source_file_checksum, column_mapping, created_by, imported_by, discarded_by, review_acknowledged_by, create_new_acknowledged_by, review_acknowledged_at, create_new_acknowledged_at, create_new_acknowledged_count, imported_at, discarded_at, discard_reason, created_at, updated_at";

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

async function recoverStaleMaterializePhase(
  batchId: string,
  batch: BatchRow,
): Promise<boolean> {
  if (!isStaleMaterializeProcessingPhaseClaim(batch)) {
    return false;
  }

  const supabase = createAdminClient();
  const phase = batch.processing_phase;
  if (!phase) return false;

  const { data, error } = await supabase
    .from("partner_alumni_import_batches")
    .update({ processing_phase: null, updated_at: new Date().toISOString() })
    .eq("id", batchId)
    .eq("status", "review")
    .eq("processing_phase", phase)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function assertMaterializeAcknowledgments(
  batch: BatchRow & Record<string, unknown>,
  batchId: string,
): Promise<void> {
  if (!batch.review_acknowledged_at) {
    throw new PartnerAlumniImportHttpError(
      422,
      "Review must be acknowledged before materialization.",
    );
  }

  const supabase = createAdminClient();
  const pendingCreateNew = await countPendingCreateNewRowsDetailed(supabase, batchId);
  if (pendingCreateNew > 0) {
    if (!batch.create_new_acknowledged_at) {
      throw new PartnerAlumniImportHttpError(
        422,
        `Create-new acknowledgment required for ${pendingCreateNew} new company(ies).`,
        { pending_create_new_count: pendingCreateNew },
      );
    }
    const ackCount =
      typeof batch.create_new_acknowledged_count === "number"
        ? batch.create_new_acknowledged_count
        : null;
    if (ackCount !== null && ackCount !== pendingCreateNew) {
      throw new PartnerAlumniImportHttpError(
        422,
        "Create-new acknowledgment count does not match pending create-new rows.",
        { acknowledged_count: ackCount, pending_create_new_count: pendingCreateNew },
      );
    }
  }

  await assertCreateNewRowsExplicit(supabase, batchId);
}

async function assertMaterializeReady(batchId: string, scope: ImportScope): Promise<BatchRow & Record<string, unknown>> {
  let batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["review"]);

  if (await recoverStaleMaterializePhase(batchId, batch)) {
    batch = await getBatchRowScoped(batchId, scope);
  }

  const rows = await loadImportRows(batchId);
  assertMaterializeGuards(rows);
  await assertMaterializeAcknowledgments(batch, batchId);

  return batch;
}

export async function acknowledgeReview(
  batchId: string,
  scope: ImportScope,
  actorId: string,
) {
  const batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["review"]);

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("partner_alumni_import_batches")
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

export async function acknowledgeCreateNew(
  batchId: string,
  scope: ImportScope,
  actorId: string,
  count: number,
) {
  const batch = await getBatchRowScoped(batchId, scope);
  assertBatchStatus(batch, ["review"]);

  if (!Number.isInteger(count) || count < 1) {
    throw new PartnerAlumniImportHttpError(400, "count must be a positive integer.");
  }

  const supabase = createAdminClient();
  const pendingCreateNew = await countPendingCreateNewRowsDetailed(supabase, batchId);
  if (pendingCreateNew !== count) {
    throw new PartnerAlumniImportHttpError(
      422,
      `Create-new acknowledgment count (${count}) does not match pending rows (${pendingCreateNew}).`,
      { pending_create_new_count: pendingCreateNew },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("partner_alumni_import_batches")
    .update({
      create_new_acknowledged_at: now,
      create_new_acknowledged_by: actorId,
      create_new_acknowledged_count: count,
      updated_at: now,
    })
    .eq("id", batchId)
    .select(BATCH_SELECT)
    .single();

  if (error) throw new Error(error.message);

  await appendActionLog({
    batchId,
    actorId,
    actionType: "create_new_acknowledged",
    payload: { count },
    affectedCount: count,
  });

  return data;
}

export async function runMaterializeCompaniesChunk(
  batchId: string,
  scope: ImportScope,
  actorId: string,
  options: { cursor?: number; limit?: number } = {},
): Promise<MaterializeCompaniesChunkResult> {
  let batch = await assertMaterializeReady(batchId, scope);

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (batch.processing_phase === "materializing_members") {
    throw new PartnerAlumniImportHttpError(
      409,
      "Version member materialization is in progress.",
    );
  }

  if (batch.processing_phase !== "materializing_companies") {
    const { data: claimed, error: claimError } = await supabase
      .from("partner_alumni_import_batches")
      .update({ processing_phase: "materializing_companies", updated_at: now })
      .eq("id", batchId)
      .eq("status", "review")
      .is("processing_phase", null)
      .select("id")
      .maybeSingle();

    if (claimError) throw new Error(claimError.message);

    if (!claimed) {
      batch = await getBatchRowScoped(batchId, scope);
      if (batch.processing_phase !== "materializing_companies") {
        if (await isPartnerAlumniCompanyMaterializationComplete(batchId)) {
          const progress = await supabase
            .from("partner_alumni_import_rows")
            .select("id", { count: "exact", head: true })
            .eq("batch_id", batchId)
            .eq("status", "resolved");
          const total = progress.count ?? 0;
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
        throw new PartnerAlumniImportHttpError(
          409,
          "Company materialization could not start. Refresh and try again.",
          { processing_phase: batch.processing_phase },
        );
      }
    }
  } else {
    const { error: touchError } = await supabase
      .from("partner_alumni_import_batches")
      .update({ updated_at: now })
      .eq("id", batchId)
      .eq("status", "review")
      .eq("processing_phase", "materializing_companies");
    if (touchError) throw new Error(touchError.message);
  }

  const result = await materializePartnerAlumniCompaniesChunk(batchId, options);

  if (result.done) {
    const { error: clearError } = await supabase
      .from("partner_alumni_import_batches")
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

export async function runMaterializeVersionMembersChunk(
  batchId: string,
  scope: ImportScope,
  actorId: string,
  options: { cursor?: number; limit?: number } = {},
): Promise<MaterializeVersionMembersChunkResult> {
  let batch = await assertMaterializeReady(batchId, scope);

  if (!(await isPartnerAlumniCompanyMaterializationComplete(batchId))) {
    throw new PartnerAlumniImportHttpError(
      409,
      "Company materialization must finish before creating version members.",
    );
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (batch.processing_phase === "materializing_companies") {
    throw new PartnerAlumniImportHttpError(
      409,
      "Company materialization is in progress.",
    );
  }

  if (batch.processing_phase !== "materializing_members") {
    const { data: claimed, error: claimError } = await supabase
      .from("partner_alumni_import_batches")
      .update({ processing_phase: "materializing_members", updated_at: now })
      .eq("id", batchId)
      .eq("status", "review")
      .is("processing_phase", null)
      .select("id")
      .maybeSingle();

    if (claimError) throw new Error(claimError.message);

    if (!claimed) {
      batch = await getBatchRowScoped(batchId, scope);
      if (batch.processing_phase !== "materializing_members") {
        throw new PartnerAlumniImportHttpError(
          409,
          "Version member materialization could not start. Refresh and try again.",
          { processing_phase: batch.processing_phase },
        );
      }
    }
  } else {
    const { error: touchError } = await supabase
      .from("partner_alumni_import_batches")
      .update({ updated_at: now })
      .eq("id", batchId)
      .eq("status", "review")
      .eq("processing_phase", "materializing_members");
    if (touchError) throw new Error(touchError.message);
  }

  const result = await materializeVersionMembersChunk(
    batchId,
    scope.versionId,
    options,
  );

  if (result.done) {
    const { error: clearError } = await supabase
      .from("partner_alumni_import_batches")
      .update({ processing_phase: null, updated_at: new Date().toISOString() })
      .eq("id", batchId)
      .eq("status", "review")
      .eq("processing_phase", "materializing_members");
    if (clearError) throw new Error(clearError.message);

    await finalizeImportBatch(batchId, scope, actorId);
  }

  await appendActionLog({
    batchId,
    actorId,
    actionType: "materialize_members_chunk",
    payload: result,
    affectedCount: result.rows_linked,
  });

  return result;
}

async function countCompaniesCreatedFromLogs(batchId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_alumni_import_action_logs")
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

async function summarizeImportCompletion(batchId: string): Promise<ImportCompletionSummary> {
  const supabase = createAdminClient();

  const { count: imported, error: importedError } = await supabase
    .from("partner_alumni_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .not("version_member_id", "is", null);
  if (importedError) throw new Error(importedError.message);

  const { count: excluded, error: excludedError } = await supabase
    .from("partner_alumni_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "excluded");
  if (excludedError) throw new Error(excludedError.message);

  let membersCreated = 0;
  let membersUpdated = 0;
  const { data: memberLogs, error: memberLogsError } = await supabase
    .from("partner_alumni_import_action_logs")
    .select("payload")
    .eq("batch_id", batchId)
    .eq("action_type", "materialize_members_chunk");
  if (memberLogsError) throw new Error(memberLogsError.message);
  for (const row of memberLogs ?? []) {
    const payload = row.payload as Record<string, unknown> | null;
    if (!payload) continue;
    if (typeof payload.members_created === "number") membersCreated += payload.members_created;
    if (typeof payload.members_updated === "number") membersUpdated += payload.members_updated;
  }

  return {
    companies_created: await countCompaniesCreatedFromLogs(batchId),
    members_created: membersCreated,
    members_updated: membersUpdated,
    rows_imported: imported ?? 0,
    rows_excluded: excluded ?? 0,
    rows_skipped: 0,
  };
}

async function finalizeImportBatch(
  batchId: string,
  scope: ImportScope,
  actorId: string,
): Promise<ImportCompletionSummary> {
  const batch = await getBatchRowScoped(batchId, scope);
  if (batch.status === "imported") {
    return summarizeImportCompletion(batchId);
  }

  if (!(await isVersionMemberMaterializationComplete(batchId))) {
    throw new PartnerAlumniImportHttpError(
      422,
      "Version member materialization is incomplete.",
    );
  }

  const summary = await summarizeImportCompletion(batchId);
  if (summary.rows_imported === 0) {
    throw new PartnerAlumniImportHttpError(422, "No version members were materialized.");
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("partner_alumni_import_batches")
    .update({
      status: "imported",
      processing_phase: null,
      imported_at: now,
      imported_by: actorId,
      updated_at: now,
    })
    .eq("id", batchId)
    .eq("status", "review")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const refreshed = await getBatchRowScoped(batchId, scope);
    if (refreshed.status === "imported") {
      return summarizeImportCompletion(batchId);
    }
    throw new PartnerAlumniImportHttpError(
      409,
      "Import could not finalize. Refresh and try again.",
      { status: refreshed.status },
    );
  }

  await appendActionLog({
    batchId,
    actorId,
    actionType: "import_completed",
    payload: summary,
    affectedCount: summary.rows_imported,
  });

  return summary;
}

function materializeActionLabel(row: Record<string, unknown>): string {
  if (row.version_member_id) return "imported";
  if (row.status === "excluded") return "excluded";
  if (row.import_error) return "error";
  return "pending";
}

export async function buildOutcomeReportCsv(
  batchId: string,
  scope: ImportScope,
): Promise<string> {
  await getBatchRowScoped(batchId, scope);
  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("partner_alumni_import_rows")
    .select(
      "excel_row_number, raw_company_name, normalized_domain, status, match_method, resolved_company_id, version_member_id, import_error, decision_type",
    )
    .eq("batch_id", batchId)
    .order("excel_row_number", { ascending: true });

  if (error) throw new Error(error.message);

  const header = [
    "excel_row_number",
    "raw_company_name",
    "normalized_domain",
    "status",
    "match_method",
    "resolved_company_id",
    "action",
    "version_member_id",
    "import_error",
  ].join(",");

  const lines = (rows ?? []).map((row) => {
    const cells = [
      row.excel_row_number,
      JSON.stringify(row.raw_company_name ?? ""),
      JSON.stringify(row.normalized_domain ?? ""),
      row.status,
      JSON.stringify(row.match_method ?? ""),
      row.resolved_company_id ?? "",
      materializeActionLabel(row as Record<string, unknown>),
      row.version_member_id ?? "",
      JSON.stringify(row.import_error ?? ""),
    ];
    return cells.join(",");
  });

  return [header, ...lines].join("\n");
}

export async function getImportCompletionSummary(
  batchId: string,
  scope: ImportScope,
): Promise<ImportCompletionSummary> {
  await getBatchRowScoped(batchId, scope);
  return summarizeImportCompletion(batchId);
}
