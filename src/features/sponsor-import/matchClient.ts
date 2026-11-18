/**
 * Client-side matching request policy.
 *
 * Timeout is intentionally below the route `maxDuration` (300s) but above the
 * observed ~164s full-batch match, so ordinary large imports can complete
 * without a client abort. A timeout still does not mean the server stopped;
 * Review always reloads persisted rows afterward.
 */
export const MATCH_TIMEOUT_MS = 280_000;

export const MATCH_FAILED_MESSAGE =
  "Company matching failed or timed out. Loading any results already saved — you can continue if the queue looks ready, or retry.";
