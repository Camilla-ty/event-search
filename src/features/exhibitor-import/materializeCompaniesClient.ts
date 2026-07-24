import type { ApiErr, ApiOk } from "./client/types";
import type { MaterializeCompaniesChunkResult } from "./types";

/** Per-chunk client timeout (below the route's 300s maxDuration). */
export const MATERIALIZE_CHUNK_TIMEOUT_MS = 150_000;

/** Safety cap so a non-progressing server can never spin the client forever. */
export const MATERIALIZE_MAX_CHUNK_ITERATIONS = 1000;

export const MATERIALIZE_COMPANIES_FAILED_MESSAGE =
  "Company creation failed or timed out. No draft was created. You can retry — companies already created are kept and skipped.";

export type MaterializeProgress = {
  rowsWithCompanyId: number;
  totalResolvedRows: number;
};

/** Human-readable progress for the company-materialization phase. */
export function materializeCompaniesProgressLabel(progress: MaterializeProgress): string {
  if (progress.totalResolvedRows <= 0) {
    return "Creating companies…";
  }
  return `Creating companies… ${progress.rowsWithCompanyId}/${progress.totalResolvedRows}`;
}

export type MaterializeChunkResponse =
  | ApiOk<{ result: MaterializeCompaniesChunkResult }>
  | ApiErr;

export type RunCompanyMaterializationResult =
  | { ok: true; result: MaterializeCompaniesChunkResult | null }
  | { ok: false; error: string };

/**
 * Drive the existing chunked company-materialization endpoint to completion.
 *
 * Reuses the server-side chunk/resume logic: each call processes one chunk and
 * returns `done` + `next_cursor`. The loop forwards the cursor to avoid
 * rescanning already-materialized rows. Already-resolved rows are skipped
 * server-side, so a fresh retry resumes safely from where it stopped.
 */
export async function runCompanyMaterialization(
  chunkFn: (cursor: number | undefined) => Promise<MaterializeChunkResponse>,
  options?: {
    onProgress?: (progress: MaterializeProgress) => void;
    maxIterations?: number;
  },
): Promise<RunCompanyMaterializationResult> {
  const maxIterations = options?.maxIterations ?? MATERIALIZE_MAX_CHUNK_ITERATIONS;
  let cursor: number | undefined;
  let last: MaterializeCompaniesChunkResult | null = null;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const response = await chunkFn(cursor);
    if (!response.ok) {
      return {
        ok: false,
        error: response.error || MATERIALIZE_COMPANIES_FAILED_MESSAGE,
      };
    }

    const result = response.result;
    last = result;

    options?.onProgress?.({
      rowsWithCompanyId: result.rows_with_company_id,
      totalResolvedRows: result.total_resolved_rows,
    });

    if (result.done) {
      return { ok: true, result };
    }

    // Defensive: a non-done chunk that examined nothing would otherwise loop forever.
    if (result.examined_count === 0) {
      return { ok: false, error: MATERIALIZE_COMPANIES_FAILED_MESSAGE };
    }

    cursor = result.next_cursor ?? cursor;
  }

  void last;
  return { ok: false, error: MATERIALIZE_COMPANIES_FAILED_MESSAGE };
}
