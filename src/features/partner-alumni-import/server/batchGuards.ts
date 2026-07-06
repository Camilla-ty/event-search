import type {
  PartnerAlumniImportBatchStatus,
  PartnerAlumniImportRowStatus,
  RowSummary,
} from "../types";
import { PartnerAlumniImportHttpError } from "./errors";

export type BatchRow = {
  id: string;
  event_series_id: string;
  event_partner_alumni_version_id: string;
  status: PartnerAlumniImportBatchStatus;
  review_acknowledged_at: string | null;
  processing_phase: string | null;
  updated_at?: string | null;
};

export type ImportRowRecord = {
  id: string;
  status: PartnerAlumniImportRowStatus;
  has_blocking_validation: boolean;
  duplicate_cluster_key?: string | null;
  duplicate_role: string | null;
  duplicate_resolution: string | null;
};

const TERMINAL_BATCH: PartnerAlumniImportBatchStatus[] = ["imported", "discarded"];

export function assertBatchStatus(
  batch: BatchRow,
  allowed: PartnerAlumniImportBatchStatus[],
): void {
  if (!allowed.includes(batch.status)) {
    throw new PartnerAlumniImportHttpError(
      409,
      `Batch status must be one of ${allowed.join(", ")} (current: ${batch.status}).`,
      { status: batch.status },
    );
  }
}

export function assertBatchNotTerminal(batch: BatchRow): void {
  if (TERMINAL_BATCH.includes(batch.status)) {
    throw new PartnerAlumniImportHttpError(409, `Batch is terminal (${batch.status}).`, {
      status: batch.status,
    });
  }
}

export function summarizeRows(rows: ImportRowRecord[]): RowSummary {
  return {
    total: rows.length,
    needs_review: rows.filter((r) => r.status === "needs_review").length,
    auto_ready: rows.filter((r) => r.status === "auto_ready").length,
    resolved: rows.filter((r) => r.status === "resolved").length,
    excluded: rows.filter((r) => r.status === "excluded").length,
    blocking_validation_count: rows.filter(
      (r) => r.status !== "excluded" && r.has_blocking_validation,
    ).length,
    pending_duplicate_count: rows.filter(
      (r) => r.duplicate_role === "duplicate" && r.duplicate_resolution === "pending",
    ).length,
  };
}

/** Orphaned materialization claims older than this may be auto-cleared. */
export const STALE_MATERIALIZE_MS = 5 * 60 * 1000;

const STALE_RECOVERABLE_PHASES = new Set([
  "materializing_companies",
  "materializing_members",
]);

export function isStaleMaterializeProcessingPhaseClaim(
  batch: Pick<BatchRow, "processing_phase" | "status" | "updated_at">,
  nowMs = Date.now(),
): boolean {
  if (batch.status !== "review") return false;
  if (!batch.processing_phase || !STALE_RECOVERABLE_PHASES.has(batch.processing_phase)) {
    return false;
  }
  const updatedAt = batch.updated_at;
  if (!updatedAt) return true;
  return nowMs - new Date(updatedAt).getTime() >= STALE_MATERIALIZE_MS;
}

export function assertMaterializeGuards(rows: ImportRowRecord[]): void {
  const blockingReasons: string[] = [];

  const blockingValidation = rows.filter(
    (r) => r.status !== "excluded" && r.has_blocking_validation,
  ).length;
  if (blockingValidation > 0) {
    blockingReasons.push(`${blockingValidation} row(s) have blocking validation`);
  }

  const pendingDuplicates = rows.filter(
    (r) => r.duplicate_role === "duplicate" && r.duplicate_resolution === "pending",
  ).length;
  if (pendingDuplicates > 0) {
    blockingReasons.push(`${pendingDuplicates} duplicate row(s) pending resolution`);
  }

  const needsReview = rows.filter((r) => r.status === "needs_review").length;
  if (needsReview > 0) {
    blockingReasons.push(`${needsReview} row(s) need review`);
  }

  const autoReady = rows.filter((r) => r.status === "auto_ready").length;
  if (autoReady > 0) {
    blockingReasons.push(`${autoReady} auto_ready row(s) must be accepted before import`);
  }

  const resolved = rows.filter((r) => r.status === "resolved").length;
  if (resolved === 0) {
    blockingReasons.push("No resolved rows to import");
  }

  if (blockingReasons.length > 0) {
    throw new PartnerAlumniImportHttpError(422, "Import materialization blocked.", {
      blockingReasons,
    });
  }
}
