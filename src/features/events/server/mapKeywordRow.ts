import type { KeywordRow } from "@/src/features/events/types/keywords";

export function mapKeywordRow(raw: unknown): KeywordRow | null {
  if (raw === null || typeof raw !== "object") return null;
  const row = raw as { id?: unknown; name?: unknown; slug?: unknown };
  if (typeof row.id !== "string" || row.id.trim() === "") return null;
  if (typeof row.name !== "string" || row.name.trim() === "") return null;
  if (typeof row.slug !== "string" || row.slug.trim() === "") return null;
  return {
    id: row.id.trim(),
    name: row.name.trim(),
    slug: row.slug.trim(),
  };
}
