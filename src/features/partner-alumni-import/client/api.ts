import {
  getPartnerAlumniImportJson,
  patchPartnerAlumniImportJson,
  postPartnerAlumniImportJson,
} from "../partnerAlumniImportRequestClient";
import type {
  ColumnMapping,
  ImportCompletionSummary,
  MaterializeCompaniesChunkResult,
  MaterializeVersionMembersChunkResult,
  MatchMethodSummary,
  MaterializePreviewSummary,
} from "../types";
import type {
  ApiErr,
  ApiOk,
  ImportScope,
  PartnerAlumniImportBatch,
  PartnerAlumniImportRow,
  RowSummary,
} from "./types";

async function parseJson<T>(response: Response): Promise<T | ApiErr> {
  return (await response.json()) as T | ApiErr;
}

export async function fetchActiveBatch(scope: ImportScope) {
  return getPartnerAlumniImportJson<ApiOk<{ batch: PartnerAlumniImportBatch | null }>>(
    scope,
    "/active-batch",
  );
}

export async function fetchBatch(scope: ImportScope, batchId: string) {
  return getPartnerAlumniImportJson<
    ApiOk<{
      batch: PartnerAlumniImportBatch;
      summary: RowSummary;
      match_method_summary: MatchMethodSummary;
      materialize_preview: MaterializePreviewSummary;
      pending_create_new_count: number;
    }>
  >(scope, `/batches/${batchId}`);
}

export async function uploadBatch(scope: ImportScope, form: FormData) {
  const res = await fetch(
    `/api/admin/event-series/${scope.seriesId}/partner-alumni/versions/${scope.versionId}/import/batches`,
    { method: "POST", body: form },
  );
  return parseJson<ApiOk<{ batch: PartnerAlumniImportBatch; rowCount: number }>>(res);
}

export async function saveColumnMapping(
  scope: ImportScope,
  batchId: string,
  column_mapping: ColumnMapping,
  transition_to_review: boolean,
) {
  return patchPartnerAlumniImportJson<ApiOk<{ batch: PartnerAlumniImportBatch }>>(
    scope,
    `/batches/${batchId}/column-mapping`,
    { column_mapping, transition_to_review },
  );
}

export async function runValidation(scope: ImportScope, batchId: string) {
  return postPartnerAlumniImportJson<ApiOk<{ validated_count: number }>>(
    scope,
    `/batches/${batchId}/validate`,
  );
}

export async function runMatching(scope: ImportScope, batchId: string) {
  return postPartnerAlumniImportJson<ApiOk<{ matched_count: number }>>(
    scope,
    `/batches/${batchId}/match`,
  );
}

export async function bulkAcceptDomains(scope: ImportScope, batchId: string) {
  return postPartnerAlumniImportJson<ApiOk<{ accepted_count: number }>>(
    scope,
    `/batches/${batchId}/rows/bulk-accept-domains`,
  );
}

export async function bulkApplyRowDecisions(
  scope: ImportScope,
  batchId: string,
  body: { decision_type: "create_new" | "exclude"; row_ids: string[] },
) {
  return postPartnerAlumniImportJson<ApiOk<{ applied_count: number; skipped_count: number }>>(
    scope,
    `/batches/${batchId}/rows/bulk-decisions`,
    body,
  );
}

export async function fetchRows(
  scope: ImportScope,
  batchId: string,
  params?: { status?: string; page?: number; pageSize?: number },
) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.page) sp.set("page", String(params.page));
  if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return getPartnerAlumniImportJson<
    ApiOk<{
      rows: PartnerAlumniImportRow[];
      total: number;
      summary: RowSummary;
      match_method_summary: MatchMethodSummary;
      materialize_preview: MaterializePreviewSummary;
      pending_create_new_count: number;
    }>
  >(scope, `/batches/${batchId}/rows${qs ? `?${qs}` : ""}`);
}

export async function patchRowDecision(
  scope: ImportScope,
  batchId: string,
  rowId: string,
  body: {
    decision_type: "use_matched" | "create_new" | "choose_different" | "exclude";
    resolved_company_id?: string | null;
    duplicate_resolution?: "kept" | "excluded";
  },
) {
  return patchPartnerAlumniImportJson<ApiOk<{ row: PartnerAlumniImportRow }>>(
    scope,
    `/batches/${batchId}/rows/${rowId}`,
    body,
  );
}

export async function acknowledgeReview(scope: ImportScope, batchId: string) {
  return postPartnerAlumniImportJson<ApiOk<{ batch: PartnerAlumniImportBatch }>>(
    scope,
    `/batches/${batchId}/acknowledge-review`,
  );
}

export async function acknowledgeCreateNew(
  scope: ImportScope,
  batchId: string,
  count: number,
) {
  return postPartnerAlumniImportJson<ApiOk<{ batch: PartnerAlumniImportBatch }>>(
    scope,
    `/batches/${batchId}/acknowledge-create-new`,
    { count },
  );
}

export async function materializeCompaniesChunk(
  scope: ImportScope,
  batchId: string,
  body: { cursor?: number; limit?: number } = {},
) {
  return postPartnerAlumniImportJson<ApiOk<{ result: MaterializeCompaniesChunkResult }>>(
    scope,
    `/batches/${batchId}/materialize-companies/chunk`,
    body,
    { signal: AbortSignal.timeout(150_000) },
  );
}

export async function materializeMembersChunk(
  scope: ImportScope,
  batchId: string,
  body: { cursor?: number; limit?: number } = {},
) {
  return postPartnerAlumniImportJson<ApiOk<{ result: MaterializeVersionMembersChunkResult }>>(
    scope,
    `/batches/${batchId}/materialize-members/chunk`,
    body,
    { signal: AbortSignal.timeout(150_000) },
  );
}

export async function fetchImportSummary(scope: ImportScope, batchId: string) {
  return getPartnerAlumniImportJson<ApiOk<{ summary: ImportCompletionSummary }>>(
    scope,
    `/batches/${batchId}/report?format=json`,
  );
}

export async function discardBatch(scope: ImportScope, batchId: string) {
  return postPartnerAlumniImportJson<ApiOk<{ batch: PartnerAlumniImportBatch }>>(
    scope,
    `/batches/${batchId}/discard`,
  );
}

export function reportCsvUrl(scope: ImportScope, batchId: string): string {
  return `/api/admin/event-series/${scope.seriesId}/partner-alumni/versions/${scope.versionId}/import/batches/${batchId}/report`;
}
