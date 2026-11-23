import type {
  SponsorImportBatchStatus,
  SponsorImportRowStatus,
  RowSummary,
} from "../types";
import { SponsorImportHttpError } from "./errors";
import { parseUtcTimestampMs } from "./matchRunPolicy";

export type BatchRow = {
  id: string;
  event_edition_id: string;
  status: SponsorImportBatchStatus;
  review_acknowledged_at: string | null;
  processing_phase: string | null;
  updated_at?: string | null;
};

/**
 * Orphaned import processing claims older than this may be auto-cleared. Each chunk refreshes
 * the claim when it starts; the margin stays well above the chunk routes' 300s maxDuration, so
 * a chunk that is still running is never judged stale.
 */
export const STALE_IMPORT_TO_DRAFT_MS = 10 * 60 * 1000;

const STALE_RECOVERABLE_PROCESSING_PHASES = new Set([
  "importing_to_draft",
  "materializing_companies",
]);

export function isStaleImportProcessingPhaseClaim(
  batch: Pick<BatchRow, "processing_phase" | "status" | "updated_at">,
  nowMs = Date.now(),
): boolean {
  if (batch.status !== "review") {
    return false;
  }
  if (!batch.processing_phase || !STALE_RECOVERABLE_PROCESSING_PHASES.has(batch.processing_phase)) {
    return false;
  }
  const updatedAt = batch.updated_at;
  if (!updatedAt) {
    return true;
  }
  // `updated_at` is a zone-less UTC timestamp; parsing it as local time would age every claim
  // by the host's UTC offset. Unparseable values are never stale.
  const claimedAtMs = parseUtcTimestampMs(updatedAt);
  if (Number.isNaN(claimedAtMs)) return false;
  return nowMs - claimedAtMs >= STALE_IMPORT_TO_DRAFT_MS;
}

/**
 * An import chunk claim not refreshed for this long can have no chunk still running: each
 * chunk refreshes the claim when it starts, and the chunk routes' maxDuration is 300s. A
 * request without the claim token may take it over after this (the 30s is clock-skew margin).
 */
export const IMPORT_CHUNK_TAKEOVER_MS = 330 * 1000;

export function isAbandonedImportChunkClaim(
  batch: Pick<BatchRow, "processing_phase" | "updated_at">,
  nowMs: number,
): boolean {
  if (!batch.processing_phase || !STALE_RECOVERABLE_PROCESSING_PHASES.has(batch.processing_phase)) {
    return false;
  }
  if (!batch.updated_at) return true;
  const claimedAtMs = parseUtcTimestampMs(batch.updated_at);
  if (Number.isNaN(claimedAtMs)) return false;
  return nowMs - claimedAtMs >= IMPORT_CHUNK_TAKEOVER_MS;
}

export function isStaleImportToDraftClaim(
  batch: Pick<BatchRow, "processing_phase" | "status" | "updated_at">,
  nowMs = Date.now(),
): boolean {
  return (
    batch.processing_phase === "importing_to_draft" &&
    isStaleImportProcessingPhaseClaim(batch, nowMs)
  );
}

export function isStaleMaterializingCompaniesClaim(
  batch: Pick<BatchRow, "processing_phase" | "status" | "updated_at">,
  nowMs = Date.now(),
): boolean {
  return (
    batch.processing_phase === "materializing_companies" &&
    isStaleImportProcessingPhaseClaim(batch, nowMs)
  );
}

export type ImportRowRecord = {
  id: string;
  status: SponsorImportRowStatus;
  has_blocking_validation: boolean;
  duplicate_cluster_key?: string | null;
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

/**
 * A `parsing` claim (column mapping save) not released after this long is treated as abandoned.
 * Mapping saves take seconds; the margin stays well above any platform request limit.
 */
export const STALE_PARSING_CLAIM_MS = 10 * 60 * 1000;

/**
 * A `validating` claim not released after this long is treated as abandoned. Validation has no
 * heartbeat; it takes seconds, and the margin stays well above any platform request limit.
 */
export const STALE_VALIDATING_CLAIM_MS = 10 * 60 * 1000;

type PhaseClaim = { processing_phase: string | null; updated_at: string | null };

/** Unknown or unparseable timestamps are never stale, so a live claim is never taken over. */
function isStaleClaimInPhase(claim: PhaseClaim, phase: string, staleAfterMs: number, nowMs: number): boolean {
  if (claim.processing_phase !== phase || !claim.updated_at) return false;
  const claimedAtMs = parseUtcTimestampMs(claim.updated_at);
  if (Number.isNaN(claimedAtMs)) return false;
  return nowMs - claimedAtMs >= staleAfterMs;
}

export function isStaleParsingClaim(claim: PhaseClaim, nowMs: number): boolean {
  return isStaleClaimInPhase(claim, "parsing", STALE_PARSING_CLAIM_MS, nowMs);
}

export function isStaleValidatingClaim(claim: PhaseClaim, nowMs: number): boolean {
  return isStaleClaimInPhase(claim, "validating", STALE_VALIDATING_CLAIM_MS, nowMs);
}

export const MATCHING_IN_PROGRESS_MUTATION_MESSAGE =
  "Company matching is in progress. Wait for it to finish, then try again.";

/** Review mutations would race the matcher's row writes; reject them while it holds the claim. */
export function assertNotMatching(batch: Pick<BatchRow, "processing_phase">): void {
  if (batch.processing_phase === "matching") {
    throw new SponsorImportHttpError(409, MATCHING_IN_PROGRESS_MUTATION_MESSAGE, {
      processing_phase: batch.processing_phase,
    });
  }
}

export const MAPPING_IN_PROGRESS_REVIEW_MESSAGE =
  "Column mapping is being saved. Review decisions cannot change until it finishes.";

export const VALIDATION_IN_PROGRESS_REVIEW_MESSAGE =
  "Validation is in progress. Review decisions cannot change until it finishes.";

export const IMPORT_IN_PROGRESS_REVIEW_MESSAGE =
  "Import to draft is in progress. Review decisions cannot change until it finishes.";

const REVIEW_BLOCKING_PHASE_MESSAGES: Record<string, string> = {
  matching: MATCHING_IN_PROGRESS_MUTATION_MESSAGE,
  parsing: MAPPING_IN_PROGRESS_REVIEW_MESSAGE,
  validating: VALIDATION_IN_PROGRESS_REVIEW_MESSAGE,
  materializing_companies: IMPORT_IN_PROGRESS_REVIEW_MESSAGE,
  importing_to_draft: IMPORT_IN_PROGRESS_REVIEW_MESSAGE,
};

/** Review decisions would race whichever workflow is rewriting or reading the batch's rows. */
export function assertNoActiveProcessingPhase(batch: Pick<BatchRow, "processing_phase">): void {
  const phase = batch.processing_phase;
  if (phase && Object.hasOwn(REVIEW_BLOCKING_PHASE_MESSAGES, phase)) {
    throw new SponsorImportHttpError(409, REVIEW_BLOCKING_PHASE_MESSAGES[phase], {
      processing_phase: phase,
    });
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
