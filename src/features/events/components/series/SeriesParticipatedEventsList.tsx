import Link from "next/link";

import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import { formatEventDateRange } from "@/src/features/events/lib/formatEventDateRange";
import type { SeriesParticipatedEvent } from "@/src/features/events/types/seriesParticipatedEvents";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

const participatedEventRowClass = [
  "flex items-start gap-3 rounded-lg px-2 py-3 transition",
  "hover:bg-brand-primary-muted/30",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2",
].join(" ");

type SeriesParticipatedEventsListProps = {
  items: ReadonlyArray<SeriesParticipatedEvent>;
};

function buildParticipatedMetaParts(edition: SeriesParticipatedEvent["edition"]): string[] {
  const dateRange = formatEventDateRange(edition.start_date, edition.end_date);
  const parts: string[] = [];
  if (edition.year !== null) parts.push(String(edition.year));
  if (dateRange !== "" && dateRange !== "Date TBC") parts.push(dateRange);
  if (edition.locationLabel !== "") parts.push(edition.locationLabel);
  return parts;
}

/**
 * Compact Series-hub list of editions where the same-brand Company appeared as a sponsor.
 * Entire row navigates to the Event Edition (Related Editions pattern).
 */
export function SeriesParticipatedEventsList({
  items,
}: SeriesParticipatedEventsListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        No participated events are listed for this event brand yet.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Participated Events</h2>
      <p className="mt-1 text-sm text-slate-500">
        Other events where this event brand appeared as a sponsor.
      </p>
      <ul className="mt-4 divide-y divide-slate-100">
        {items.map((item) => {
          const { edition, roleLabel } = item;
          const href = buildEventDetailPath(edition);
          const metaParts = buildParticipatedMetaParts(edition);

          const content = (
            <>
              <SeriesLogo
                series={edition.event_series}
                fallbackName={edition.name}
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                monogramClassName="text-base font-semibold text-slate-400"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{edition.name}</p>
                {metaParts.length > 0 ? (
                  <p className="mt-0.5 text-xs text-slate-500">{metaParts.join(" · ")}</p>
                ) : null}
                {roleLabel ? (
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="text-slate-400">Sponsor role</span>
                    <span className="mx-1.5 text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-600">{roleLabel}</span>
                  </p>
                ) : null}
              </div>
            </>
          );

          return (
            <li key={edition.id} className="first:pt-0 last:pb-0">
              {href ? (
                <Link
                  href={href}
                  className={participatedEventRowClass}
                  aria-label={
                    roleLabel
                      ? `View ${edition.name} (${roleLabel})`
                      : `View ${edition.name}`
                  }
                >
                  {content}
                </Link>
              ) : (
                <div className="flex items-start gap-3 px-2 py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
