import Link from "next/link";

import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import type { PublicEventSeriesSummary } from "@/src/features/events/types/publicEdition";
import { secondaryCtaClass } from "@/src/lib/design/classes";
import { buildSeriesHubPath } from "@/src/lib/routes/explorerUrls";

type TopicSeriesListProps = {
  series: PublicEventSeriesSummary[];
};

export function TopicSeriesList({ series }: TopicSeriesListProps) {
  if (series.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        No event brands are tagged with this topic yet.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Event brands</h2>
      <ul className="mt-4 divide-y divide-slate-100">
        {series.map((item) => {
          const href = buildSeriesHubPath(item);

          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <SeriesLogo
                  series={item}
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                  imageClassName="max-h-full max-w-full object-contain p-1"
                  monogramClassName="text-base font-semibold text-slate-400"
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{item.name}</p>
                </div>
              </div>
              {href ? (
                <Link href={href} className={`${secondaryCtaClass} h-9 shrink-0 px-4`}>
                  View brand
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
