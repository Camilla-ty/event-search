import {
  formatEventLastReviewedDate,
  formatPrimarySourceLink,
} from "@/src/features/events/lib/formatEventResearchMetadata";
import { brandLinkClass } from "@/src/lib/design/classes";

import { MetadataRow } from "./MetadataRow";

type ResearchInformationSectionProps = {
  lastReviewedAt: string | null | undefined;
  primarySourceUrl: string | null | undefined;
};

export function ResearchInformationSection({
  lastReviewedAt,
  primarySourceUrl,
}: ResearchInformationSectionProps) {
  const reviewedLabel = formatEventLastReviewedDate(lastReviewedAt);
  const sourceLink = formatPrimarySourceLink(primarySourceUrl);

  if (!reviewedLabel && !sourceLink) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Research Information</h2>
      <dl className="mt-3 space-y-3">
        {reviewedLabel ? (
          <MetadataRow label="Last Reviewed">{reviewedLabel}</MetadataRow>
        ) : null}
        {sourceLink ? (
          <MetadataRow label="Primary Source">
            <a
              href={sourceLink.href}
              target="_blank"
              rel="noreferrer"
              className={brandLinkClass}
            >
              {sourceLink.label}
            </a>
          </MetadataRow>
        ) : null}
      </dl>
    </section>
  );
}
