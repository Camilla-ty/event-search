import Link from "next/link";

import type { PublicKeywordSummary } from "@/src/features/events/types/keywords";
import { brandLinkClass } from "@/src/lib/design/classes";
import { buildEventExplorerTopicUrl } from "@/src/lib/routes/explorerUrls";

type TopicHubHeaderProps = {
  topic: PublicKeywordSummary;
};

export function TopicHubHeader({ topic }: TopicHubHeaderProps) {
  const viewAllEventsHref = buildEventExplorerTopicUrl(topic.slug);

  return (
    <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Topic
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">{topic.name}</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Event brands and editions tagged with this topic on EventPixels.
          </p>
        </div>
        <Link href={viewAllEventsHref} className={`shrink-0 text-sm ${brandLinkClass}`}>
          View all events
        </Link>
      </div>
    </header>
  );
}
