import Link from "next/link";

import { formatEventDateRange } from "@/src/features/events/lib/formatEventDateRange";
import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import { secondaryCtaClass } from "@/src/lib/design/classes";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

type TopicEditionsListProps = {
  editions: PublicEditionSummary[];
};

export function TopicEditionsList({ editions }: TopicEditionsListProps) {
  if (editions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        No events are tagged with this topic yet.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Events</h2>
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
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
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
                  <p className="font-medium text-slate-900">{edition.name}</p>
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
    </section>
  );
}
