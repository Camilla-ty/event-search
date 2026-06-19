import Link from "next/link";

import { formatEventDateRange } from "@/src/features/events/lib/formatEventDateRange";
import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import { secondaryCtaClass } from "@/src/lib/design/classes";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

type DiscoverEditionListProps = {
  editions: PublicEditionSummary[];
};

export function DiscoverEditionList({ editions }: DiscoverEditionListProps) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
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
            className="flex flex-col gap-3 px-4 py-4 first:pt-4 last:pb-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <SeriesLogo
                series={edition.event_series}
                logoUrl={edition.display_logo_url}
                fallbackName={edition.name}
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                monogramClassName="text-base font-semibold text-slate-400"
              />
              <div className="min-w-0">
                <p className="line-clamp-1 font-medium text-slate-900">{edition.name}</p>
                {edition.event_series?.name ? (
                  <p className="line-clamp-1 text-xs text-slate-500">
                    {edition.event_series.name}
                  </p>
                ) : null}
                {metaParts.length > 0 ? (
                  <p className="text-xs text-slate-500">{metaParts.join(" · ")}</p>
                ) : null}
              </div>
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
  );
}
