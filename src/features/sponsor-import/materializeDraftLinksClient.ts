import type { ApiErr, ApiOk } from "./client/types";
import type { MaterializeDraftLinksChunkResult } from "./types";
import {
  MATERIALIZE_CHUNK_TIMEOUT_MS,
  MATERIALIZE_MAX_CHUNK_ITERATIONS,
} from "./materializeCompaniesClient";

export const MATERIALIZE_DRAFT_LINKS_FAILED_MESSAGE =
  "Draft-link creation failed or timed out. You can retry — links already created are kept and skipped.";

export type DraftLinkMaterializeProgress = {
  rowsWithDraftLink: number;
  totalResolvedRows: number;
};

/** Human-readable progress for the draft-link materialization phase. */
export function materializeDraftLinksProgressLabel(
  progress: DraftLinkMaterializeProgress,
): string {
  if (progress.totalResolvedRows <= 0) {
    return "Creating draft links…";
  }
  return `Creating draft links… ${progress.rowsWithDraftLink}/${progress.totalResolvedRows}`;
}

export type MaterializeDraftLinksChunkResponse =
  | ApiOk<{ result: MaterializeDraftLinksChunkResult }>
  | ApiErr;

export type RunDraftLinkMaterializationResult =
  | { ok: true; result: MaterializeDraftLinksChunkResult | null }
  | { ok: false; error: string };

/**
 * Drive the chunked draft-link materialization endpoint to completion.
 *
 * Reuses server-side chunk/resume logic. Rows that already have draft_link_id
 * are skipped, so a fresh retry resumes safely from where it stopped.
 */
export async function runDraftLinkMaterialization(
  chunkFn: (cursor: number | undefined) => Promise<MaterializeDraftLinksChunkResponse>,
  options?: {
    onProgress?: (progress: DraftLinkMaterializeProgress) => void;
    maxIterations?: number;
  },
): Promise<RunDraftLinkMaterializationResult> {
  const maxIterations = options?.maxIterations ?? MATERIALIZE_MAX_CHUNK_ITERATIONS;
  let cursor: number | undefined;
  let last: MaterializeDraftLinksChunkResult | null = null;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const response = await chunkFn(cursor);
    if (!response.ok) {
      return {
        ok: false,
        error: response.error || MATERIALIZE_DRAFT_LINKS_FAILED_MESSAGE,
      };
    }

    const result = response.result;
    last = result;

    options?.onProgress?.({
      rowsWithDraftLink: result.rows_with_draft_link,
      totalResolvedRows: result.total_resolved_rows,
    });

    if (result.done) {
      return { ok: true, result };
    }

    if (result.examined_count === 0) {
      return { ok: false, error: MATERIALIZE_DRAFT_LINKS_FAILED_MESSAGE };
    }

    cursor = result.next_cursor ?? cursor;
  }

  void last;
  return { ok: false, error: MATERIALIZE_DRAFT_LINKS_FAILED_MESSAGE };
}

export { MATERIALIZE_CHUNK_TIMEOUT_MS, MATERIALIZE_MAX_CHUNK_ITERATIONS };
