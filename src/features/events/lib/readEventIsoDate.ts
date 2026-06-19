export function readEventIsoDate(value: string | null | undefined): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return "";

  const isoDate = trimmed.slice(0, 10);
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));

  if (month < 1 || month > 12 || day < 1 || day > 31) return "";

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return "";
  }

  return isoDate;
}

export type EventDateRange = {
  start: string;
  end: string;
};

export function readEventDateRange(event: {
  start_date?: string | null;
  end_date?: string | null;
}): EventDateRange | null {
  const start = readEventIsoDate(event.start_date);
  if (start === "") return null;

  const endCandidate = readEventIsoDate(event.end_date);
  const end = endCandidate !== "" ? endCandidate : start;

  if (end < start) {
    return { start, end: start };
  }

  return { start, end };
}
