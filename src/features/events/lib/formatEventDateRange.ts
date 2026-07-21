import { formatPublicEventDateRange } from "@/src/lib/date/formatPublicEventDateRange";

export function formatEventDateRange(start?: string | null, end?: string | null): string {
  return formatPublicEventDateRange(start, end) ?? "Date TBC";
}
