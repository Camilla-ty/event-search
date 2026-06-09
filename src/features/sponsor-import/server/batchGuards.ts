import type {
  SponsorImportBatchStatus,
  SponsorImportRowStatus,
  RowSummary,
} from "../types";
import { SponsorImportHttpError } from "./errors";

export type BatchRow = {
  id: string;
  event_edition_id: string;
  status: SponsorImportBatchStatus;
  review_acknowledged_at: string | null;
  processing_phase: string | null;
};

export type ImportRowRecord = {
  id: string;
  status: SponsorImportRowStatus;
  has_blocking_validation: boolean;
  duplicate_role: string | null;
  duplicate_resolution: string | null;
};

const TERMINAL_BATCH: SponsorImportBatchStatus[] = ["published", "discarded"];

export function assertBatchStatus(batch: BatchRow, allowed: SponsorImportBatchStatus[]): void {
  if (!allowed.includes(batch.status)) {
    throw new SponsorImportHttpError(
      409,
      `Batch status must be one of ${allowed.join(", ")} (current: ${batch.status}).`,
      { status: batch.status },
    );
  }
}

export function assertBatchNotTerminal(batch: BatchRow): void {
  if (TERMINAL_BATCH.includes(batch.status)) {
    throw new SponsorImportHttpError(409, `Batch is terminal (${batch.status}).`, {
      status: batch.status,
    });
  }
}

export function assertImportToDraftGuards(rows: ImportRowRecord[]): void {
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
    blockingReasons.push(
      `${autoReady} auto_ready row(s) must be bulk accepted before import-to-draft`,
    );
  }

  if (blockingReasons.length > 0) {
    throw new SponsorImportHttpError(422, "Import-to-draft blocked.", {
      blockingReasons,
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
