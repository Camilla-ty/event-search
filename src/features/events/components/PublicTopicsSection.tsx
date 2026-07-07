import { KeywordChipList } from "@/src/features/events/components/KeywordChipList";
import type { PublicKeywordSummary } from "@/src/features/events/types/keywords";

type PublicTopicsSectionProps = {
  topics: ReadonlyArray<PublicKeywordSummary>;
  layout?: "stacked" | "header";
};

export function PublicTopicsSection({
  topics,
  layout = "stacked",
}: PublicTopicsSectionProps) {
  if (topics.length === 0) return null;

  if (layout === "header") {
    return (
      <div className="flex w-full flex-wrap gap-1.5 md:max-w-[45%] md:justify-end lg:max-w-[50%]">
        <span className="sr-only">Keywords</span>
        <KeywordChipList keywords={topics} variant="link" size="compact" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">Keywords</p>
      <KeywordChipList keywords={topics} variant="link" />
    </div>
  );
}
