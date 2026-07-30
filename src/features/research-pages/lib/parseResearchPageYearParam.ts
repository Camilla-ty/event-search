const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

/**
 * Parse a public route year segment.
 * Accepts a 4-digit integer in 1990–2100 with no leading zeros.
 */
export function parseResearchPageYearParam(raw: string): number | null {
  if (!/^[1-9]\d{3}$/.test(raw)) return null;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) return null;
  return year;
}
