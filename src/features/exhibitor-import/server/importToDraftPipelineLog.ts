import type {
  ImportToDraftResult,
  MaterializeCompaniesChunkResult,
  MaterializeDraftLinksChunkResult,
} from "../types";
import { ExhibitorImportHttpError } from "./errors";

export type ImportToDraftPipelinePhase =
  | "materialize_companies_chunk"
  | "materialize_draft_links_chunk"
  | "import_to_draft_finalize";

const LOG_PREFIX = "[exhibitor-import/import-to-draft]";

export type ImportToDraftPipelineLogContext = {
  batchId: string;
  phase: ImportToDraftPipelinePhase;
  actorId: string;
  cursor?: number;
  limit?: number;
};

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof ExhibitorImportHttpError) {
    return {
      errorMessage: error.message,
      errorName: error.name,
      errorStatus: error.status,
      ...(error.details !== undefined ? { errorDetails: error.details } : {}),
    };
  }

  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
    };
  }

  return { errorMessage: String(error) };
}

export function summarizeMaterializeCompaniesChunkResult(
  result: MaterializeCompaniesChunkResult,
): Record<string, unknown> {
  return {
    processed: {
      examined_count: result.examined_count,
      skipped_count: result.skipped_count,
      materialized_count: result.materialized_count,
      companies_created: result.companies_created,
    },
    progress: {
      total_resolved_rows: result.total_resolved_rows,
      rows_with_company_id: result.rows_with_company_id,
      done: result.done,
      next_cursor: result.next_cursor,
    },
  };
}

export function summarizeMaterializeDraftLinksChunkResult(
  result: MaterializeDraftLinksChunkResult,
): Record<string, unknown> {
  return {
    processed: {
      examined_count: result.examined_count,
      skipped_count: result.skipped_count,
      links_created: result.links_created,
      links_updated: result.links_updated,
      rows_linked: result.rows_linked,
    },
    progress: {
      total_resolved_rows: result.total_resolved_rows,
      rows_with_draft_link: result.rows_with_draft_link,
      done: result.done,
      next_cursor: result.next_cursor,
    },
  };
}

export function summarizeImportToDraftFinalizeResult(
  result: ImportToDraftResult,
): Record<string, unknown> {
  return {
    processed: {
      companies_created: result.companies_created,
      draft_links_created: result.draft_links_created,
      draft_links_updated: result.draft_links_updated,
      rows_materialized: result.rows_materialized,
    },
  };
}

export async function withImportToDraftPipelineLog<T>(
  context: ImportToDraftPipelineLogContext,
  run: () => Promise<T>,
  summarizeResult: (result: T) => Record<string, unknown>,
): Promise<T> {
  const startedAtMs = Date.now();

  console.info(LOG_PREFIX, {
    event: "start",
    ...context,
    startedAt: new Date(startedAtMs).toISOString(),
  });

  try {
    const result = await run();
    console.info(LOG_PREFIX, {
      event: "success",
      ...context,
      durationMs: Date.now() - startedAtMs,
      ...summarizeResult(result),
    });
    return result;
  } catch (error) {
    console.error(LOG_PREFIX, {
      event: "error",
      ...context,
      durationMs: Date.now() - startedAtMs,
      ...serializeError(error),
    });
    throw error;
  }
}
