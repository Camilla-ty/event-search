import { KeywordChipList } from "@/src/features/events/components/KeywordChipList";
import type { PublicKeywordSummary } from "@/src/features/events/types/keywords";

type PublicTopicsSectionProps = {
  topics: ReadonlyArray<PublicKeywordSummary>;
};

export function PublicTopicsSection({ topics }: PublicTopicsSectionProps) {
  if (topics.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">Topics</p>
      <KeywordChipList keywords={topics} variant="link" />
    </div>
  );
}
