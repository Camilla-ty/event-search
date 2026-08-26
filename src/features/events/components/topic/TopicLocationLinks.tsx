import Link from "next/link";

import { formatResearchPagePublicPath } from "@/src/features/research-pages/lib/formatResearchPagePublicPath";
import type { PublishedResearchPage } from "@/src/features/research-pages/server/researchPagesPublic";
import { brandLinkClass } from "@/src/lib/design/classes";

type TopicLocationLinksProps = {
  topicName: string;
  pages: PublishedResearchPage[];
};

export function TopicLocationLinks({
  topicName,
  pages,
}: TopicLocationLinksProps) {
  if (pages.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        By location
      </p>
      <ul className="mt-2 space-y-1">
        {pages.map((page) => {
          const label =
            page.year === null
              ? `${topicName} events in ${page.locationName} →`
              : `${topicName} events in ${page.locationName} (${page.year}) →`;

          return (
            <li key={page.id} className="text-sm text-slate-700">
              <Link
                href={formatResearchPagePublicPath(
                  page.topicSlug,
                  { type: page.locationType, slug: page.locationSlug },
                  page.year,
                )}
                className={brandLinkClass}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
