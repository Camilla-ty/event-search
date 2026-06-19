import { KeywordChipList } from "@/src/features/events/components/KeywordChipList";

type SeriesKeywordsChipsProps = {
  keywords: ReadonlyArray<{ id: string; name: string }>;
};

export function SeriesKeywordsChips({ keywords }: SeriesKeywordsChipsProps) {
  return <KeywordChipList keywords={keywords} variant="static" />;
}
