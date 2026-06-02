/** Normalize email for auth lookups (trim + lowercase). Returns null if empty after trim. */
export function normalizeAuthEmail(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}
