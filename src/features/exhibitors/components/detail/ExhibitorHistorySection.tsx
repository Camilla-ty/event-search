import Link from "next/link";

import { Badge } from "@/src/components/common";
import { formatEventDateRange } from "@/src/features/events/lib/formatEventDateRange";
import {
  formatExhibitorHistoryTierLabel,
  shouldShowExhibitorHistorySection,
  type ExhibitorHistorySeriesGroup,
} from "@/src/features/exhibitors/server/exhibitorHistoryModel";
import { secondaryCtaClass } from "@/src/lib/design/classes";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

type ExhibitorHistorySectionProps = {
  groups: ExhibitorHistorySeriesGroup[];
};

export function ExhibitorHistorySection({ groups }: ExhibitorHistorySectionProps) {
  if (!shouldShowExhibitorHistorySection(groups)) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Exhibitor history</h2>

      <ul className="mt-4 space-y-2">
        {groups.map((group) => {
          const editionCount = group.editions.length;
          return (
            <li key={group.series.id}>
              <details className="group rounded-lg border border-slate-200 open:bg-slate-50">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm text-slate-900">
                  <span className="font-medium">{group.series.name}</span>
                  <span className="text-xs font-normal text-slate-500">
                    {editionCount} {pluralize(editionCount, "event", "events")}
                  </span>
                </summary>

                <ul className="divide-y divide-slate-100 border-t border-slate-200">
                  {group.editions.map((entry) => {
                    const edition = entry.edition;
                    const eventHref = buildEventDetailPath({
                      slug: typeof edition.slug === "string" ? edition.slug : null,
                      id:
                        typeof edition.id === "string"
                          ? edition.id
                          : edition.id != null
                            ? String(edition.id)
                            : null,
                    });
                    const year =
                      typeof edition.year === "number" ? edition.year : null;
                    const dateRange = formatEventDateRange(
                      edition.start_date,
                      edition.end_date,
                    );
                    const hasUsableDateRange =
                      dateRange !== "" && dateRange !== "Date TBC";
                    const cityLabel = formatLocationFromCityEmbed(
                      (edition as { cities?: unknown }).cities,
                    );
                    const metaParts: string[] = [];
                    if (year !== null) metaParts.push(String(year));
                    if (hasUsableDateRange) metaParts.push(dateRange);
                    if (cityLabel) metaParts.push(cityLabel);
                    const tierDisplay = formatExhibitorHistoryTierLabel(
                      entry.tierRank,
                      entry.tierLabel,
                    );

                    return (
                      <li
                        key={String(edition.id)}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-slate-900">
                            {edition.name ?? "Untitled event"}
                          </p>
                          {metaParts.length > 0 ? (
                            <p className="text-xs text-slate-500">
                              {metaParts.join(" · ")}
                            </p>
                          ) : null}
                          {tierDisplay ? (
                            <Badge variant="success">{tierDisplay}</Badge>
                          ) : null}
                        </div>
                        {eventHref ? (
                          <Link
                            href={eventHref}
                            className={`${secondaryCtaClass} h-9 shrink-0 px-4`}
                          >
                            View event
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
