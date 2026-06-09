import type { ColumnMapping } from "../types";
import type {
  ApiErr,
  ApiOk,
  BatchListItem,
  DraftDiffSummary,
  DraftLinkRow,
  PublishResult,
  RowSummary,
  SponsorImportBatch,
  SponsorImportRow,
} from "./types";

async function parseJson<T>(response: Response): Promise<T | ApiErr> {
  return (await response.json()) as T | ApiErr;
}

export async function fetchActiveBatch(editionId: string) {
  const res = await fetch(
    `/api/admin/sponsor-imports/active-batch?editionId=${encodeURIComponent(editionId)}`,
  );
  return parseJson<ApiOk<{ batch: SponsorImportBatch | null }>>(res);
}

export async function fetchBatches(params?: {
  editionId?: string;
  status?: string;
  limit?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.editionId) sp.set("editionId", params.editionId);
  if (params?.status) sp.set("status", params.status);
  if (params?.limit) sp.set("limit", String(params.limit));
  const res = await fetch(`/api/admin/sponsor-imports/batches?${sp.toString()}`);
  return parseJson<ApiOk<{ batches: BatchListItem[]; total: number }>>(res);
}

export async function fetchBatch(batchId: string) {
  const res = await fetch(`/api/admin/sponsor-imports/batches/${batchId}`);
  return parseJson<ApiOk<{ batch: SponsorImportBatch; summary: RowSummary }>>(res);
}

export async function uploadBatch(form: FormData) {
  const res = await fetch("/api/admin/sponsor-imports/batches", {
    method: "POST",
    body: form,
  });
  return parseJson<ApiOk<{ batch: SponsorImportBatch; rowCount: number }>>(res);
}

export async function saveColumnMapping(
  batchId: string,
  column_mapping: ColumnMapping,
  transition_to_review: boolean,
) {
  const res = await fetch(`/api/admin/sponsor-imports/batches/${batchId}/column-mapping`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column_mapping, transition_to_review }),
  });
  return parseJson<ApiOk<{ batch: SponsorImportBatch }>>(res);
}

export async function runValidation(batchId: string) {
  const res = await fetch(`/api/admin/sponsor-imports/batches/${batchId}/validate`, {
    method: "POST",
  });
  return parseJson<ApiOk<{ validated_count: number }>>(res);
}

export async function runMatching(batchId: string) {
  const res = await fetch(`/api/admin/sponsor-imports/batches/${batchId}/match`, {
    method: "POST",
  });
  return parseJson<ApiOk<{ matched_count: number }>>(res);
}

export async function bulkAcceptDomains(batchId: string) {
  const res = await fetch(
    `/api/admin/sponsor-imports/batches/${batchId}/rows/bulk-accept-domains`,
    { method: "POST" },
  );
  return parseJson<ApiOk<{ accepted_count: number }>>(res);
}

export async function bulkApplyRowDecisions(
  batchId: string,
  body: { decision_type: "create_new" | "exclude"; row_ids: string[] },
) {
  const res = await fetch(
    `/api/admin/sponsor-imports/batches/${batchId}/rows/bulk-decisions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return parseJson<ApiOk<{ applied_count: number; skipped_count: number }>>(res);
}

export async function fetchRows(
  batchId: string,
  params?: { status?: string; page?: number; pageSize?: number },
) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.page) sp.set("page", String(params.page));
  if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
  const res = await fetch(
    `/api/admin/sponsor-imports/batches/${batchId}/rows?${sp.toString()}`,
  );
  return parseJson<
    ApiOk<{
      rows: SponsorImportRow[];
      total: number;
      page: number;
      pageSize: number;
      summary: RowSummary;
    }>
  >(res);
}

export async function patchRowDecision(
  batchId: string,
  rowId: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(`/api/admin/sponsor-imports/batches/${batchId}/rows/${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<ApiOk<{ row: SponsorImportRow }>>(res);
}

export async function importToDraft(batchId: string) {
  const res = await fetch(`/api/admin/sponsor-imports/batches/${batchId}/import-to-draft`, {
    method: "POST",
  });
  return parseJson<ApiOk<{ result: Record<string, number> }>>(res);
}

export async function fetchDraftLinks(batchId: string) {
  const res = await fetch(`/api/admin/sponsor-imports/batches/${batchId}/draft-links`);
  return parseJson<
    ApiOk<{ links: DraftLinkRow[]; diff: DraftDiffSummary }>
  >(res);
}

export async function patchDraftLink(
  batchId: string,
  linkId: string,
  body: { tier_rank?: number; excluded_from_publish?: boolean },
) {
  const res = await fetch(
    `/api/admin/sponsor-imports/batches/${batchId}/draft-links/${linkId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return parseJson<ApiOk<{ link: DraftLinkRow }>>(res);
}

export async function acknowledgeReview(batchId: string) {
  const res = await fetch(
    `/api/admin/sponsor-imports/batches/${batchId}/acknowledge-review`,
    { method: "POST" },
  );
  return parseJson<ApiOk<{ batch: SponsorImportBatch }>>(res);
}

export async function publishBatch(batchId: string) {
  const res = await fetch(`/api/admin/sponsor-imports/batches/${batchId}/publish`, {
    method: "POST",
  });
  return parseJson<ApiOk<{ result: PublishResult }>>(res);
}

export async function discardBatch(batchId: string, discard_reason?: string) {
  const res = await fetch(`/api/admin/sponsor-imports/batches/${batchId}/discard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ discard_reason: discard_reason ?? null }),
  });
  return parseJson<ApiOk<{ batch: SponsorImportBatch }>>(res);
}
