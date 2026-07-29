import { formatPublicEventDateRange } from "@/src/lib/date/formatPublicEventDateRange";

export type ActiveFilterDateChip = {
  /** Chip group label shown before the colon. */
  label: "Date" | "From" | "Until";
  /** Day-level value from the canonical public date formatter. */
  value: string;
};

/**
 * Active Filters Date group chip (exact day-level labels via formatPublicEventDateRange).
 * Returns null when neither bound is a usable date.
 */
export function formatActiveFilterDateChip(
  startDate: string,
  endDate: string,
): ActiveFilterDateChip | null {
  const start = startDate.trim();
  const end = endDate.trim();

  if (start !== "" && end !== "") {
    const value = formatPublicEventDateRange(start, end);
    if (value === null) return null;
    return { label: "Date", value };
  }

  if (start !== "") {
    const value = formatPublicEventDateRange(start, null);
    if (value === null) return null;
    return { label: "From", value };
  }

  if (end !== "") {
    const value = formatPublicEventDateRange(null, end);
    if (value === null) return null;
    return { label: "Until", value };
  }

  return null;
}
