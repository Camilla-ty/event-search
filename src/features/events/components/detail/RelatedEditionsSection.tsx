import Link from "next/link";

import { formatEventDateRange } from "@/src/features/events/lib/formatEventDateRange";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import { brandLinkClass } from "@/src/lib/design/classes";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

const relatedEditionLinkClass = [
  "block rounded-lg px-2 py-3 transition",
  "hover:bg-brand-primary-muted/30",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2",
].join(" ");

type RelatedEditionsSectionProps = {
  seriesName: string;
  seriesHubHref: string;
  editions: PublicEditionSummary[];
};

export function RelatedEditionsSection({
  seriesName,
  seriesHubHref,
  editions,
}: RelatedEditionsSectionProps) {
  if (editions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">More from {seriesName}</h2>
        <Link href={seriesHubHref} className={`text-sm ${brandLinkClass}`}>
          View all events
        </Link>
      </div>

      <ul className="mt-4 divide-y divide-slate-100">
        {editions.map((edition) => {
          const href = buildEventDetailPath(edition);
          const dateRange = formatEventDateRange(edition.start_date, edition.end_date);
          const metaParts: string[] = [];
          if (edition.year !== null) metaParts.push(String(edition.year));
          if (dateRange !== "Date TBC") metaParts.push(dateRange);
          if (edition.locationLabel !== "") metaParts.push(edition.locationLabel);

          const content = (
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{edition.name}</p>
              {metaParts.length > 0 ? (
                <p className="text-xs text-slate-500">{metaParts.join(" · ")}</p>
              ) : null}
            </div>
          );

          return (
            <li key={edition.id} className="first:pt-0 last:pb-0">
              {href ? (
                <Link href={href} className={relatedEditionLinkClass} aria-label={`View ${edition.name}`}>
                  {content}
                </Link>
              ) : (
                <div className="px-2 py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
