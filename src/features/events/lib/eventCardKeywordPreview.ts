import type { EventSeriesKeywordSummary } from "@/src/features/events/components/explorer/types";

export type EventCardKeywordChip = {
  key: string;
  label: string;
};

export type EventCardKeywordPreview = {
  visibleKeywords: EventCardKeywordChip[];
  overflowCount: number;
};

const DEFAULT_MAX_VISIBLE_KEYWORDS = 3;

export function buildEventCardKeywordPreview(
  keywords: readonly EventSeriesKeywordSummary[] | null | undefined,
  maxVisible = DEFAULT_MAX_VISIBLE_KEYWORDS,
): EventCardKeywordPreview | null {
  if (!keywords || keywords.length === 0) {
    return null;
  }

  const visibleKeywords: EventCardKeywordChip[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    const label = (keyword.name ?? keyword.slug ?? "").trim();
    if (label === "") continue;

    const key = keyword.id.trim() !== "" ? keyword.id : keyword.slug || label;
    if (seen.has(key)) continue;
    seen.add(key);

    visibleKeywords.push({ key, label });
  }

  if (visibleKeywords.length === 0) {
    return null;
  }

  const overflowCount = Math.max(0, visibleKeywords.length - maxVisible);

  return {
    visibleKeywords: visibleKeywords.slice(0, maxVisible),
    overflowCount,
  };
}
