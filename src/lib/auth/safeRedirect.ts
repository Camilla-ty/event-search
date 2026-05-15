/** Internal path only — blocks open redirects via `?redirect=`. */
export function safeRedirectTarget(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}
