import { formatEventLastReviewedDate } from "@/src/features/events/lib/formatEventResearchMetadata";

import { MetadataRow } from "./MetadataRow";

type ResearchInformationSectionProps = {
  lastReviewedAt: string | null | undefined;
};

export function ResearchInformationSection({
  lastReviewedAt,
}: ResearchInformationSectionProps) {
  const reviewedLabel = formatEventLastReviewedDate(lastReviewedAt);

  if (!reviewedLabel) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Research Information</h2>
      <dl className="mt-3 space-y-3">
        <MetadataRow label="Last Reviewed">{reviewedLabel}</MetadataRow>
      </dl>
    </section>
  );
}
