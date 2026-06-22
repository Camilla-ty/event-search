/** Client-side timeout for import-to-draft (below typical serverless maxDuration). */
export const IMPORT_TO_DRAFT_TIMEOUT_MS = 150_000;

export const IMPORT_TO_DRAFT_FAILED_MESSAGE =
  "Import to draft failed or timed out. No draft was created. You can retry.";
