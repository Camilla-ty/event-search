import Link from "next/link";

import { formatEventDateRange } from "@/src/features/events/lib/formatEventDateRange";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import { brandLinkClass, secondaryCtaClass } from "@/src/lib/design/classes";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

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

          return (
            <li
              key={edition.id}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{edition.name}</p>
                {metaParts.length > 0 ? (
                  <p className="text-xs text-slate-500">{metaParts.join(" · ")}</p>
                ) : null}
              </div>
              {href ? (
                <Link href={href} className={`${secondaryCtaClass} h-9 shrink-0 px-4`}>
                  View event
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
