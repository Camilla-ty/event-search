/** Marketing-site origins allowed to read /api/public/stats cross-origin. */
export const PUBLIC_STATS_ALLOWED_ORIGINS = [
  "https://eventpx.com",
  "https://www.eventpx.com",
] as const;

const allowedOrigins = new Set<string>(PUBLIC_STATS_ALLOWED_ORIGINS);

export function resolvePublicStatsCorsOrigin(origin: string | null): string | null {
  if (origin === null || origin.trim() === "") {
    return null;
  }

  return allowedOrigins.has(origin) ? origin : null;
}

/** CORS headers for allowlisted marketing origins only; empty when origin is missing or not allowed. */
export function publicStatsCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = resolvePublicStatsCorsOrigin(origin);
  if (allowedOrigin === null) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    Vary: "Origin",
  };
}
