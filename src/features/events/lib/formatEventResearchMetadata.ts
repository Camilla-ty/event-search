import { formatPublicCompanyWebsite } from "@/src/lib/domain/formatPublicCompanyWebsite";

export function toReviewedAtDateInputValue(
  value: string | null | undefined,
): string {
  if (typeof value !== "string" || value.trim() === "") return "";
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

/** Today's calendar date in the user's local timezone, for `<input type="date">`. */
export function localTodayDateInputValue(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatEventLastReviewedDate(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return null;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatPrimarySourceLink(
  url: string | null | undefined,
): { href: string; label: string } | null {
  const trimmed = url?.trim() ?? "";
  if (trimmed === "") return null;

  return formatPublicCompanyWebsite({ website: trimmed, domain: null });
}
