import Link from "next/link";

import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import type { EventEditionListItem } from "@/src/features/events/server/eventEditionAdmin";

export function editionHasAssignedVenue(edition: EventEditionListItem): boolean {
  if (edition.venue_id !== null && edition.venue_id.trim() !== "") {
    return true;
  }
  return Boolean(edition.venues?.id);
}

export function editionHasLastReviewed(
  lastReviewedAt: string | null | undefined,
): boolean {
  return Boolean(lastReviewedAt);
}

export function editionHasSponsors(liveSponsorCount: number): boolean {
  return liveSponsorCount > 0;
}

export function editionHasExhibitors(exhibitorCount: number): boolean {
  return exhibitorCount > 0;
}

function PresenceMark({
  present,
  label,
}: {
  present: boolean;
  label: string;
}) {
  if (!present) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <span className="text-brand-success" aria-label={label}>
      ✓
    </span>
  );
}

type AdminEventEditionsListTableProps = {
  editions: EventEditionListItem[];
  loading?: boolean;
};

export function AdminEventEditionsListTable({
  editions,
  loading = false,
}: AdminEventEditionsListTableProps) {
  return (
    <div
      className={[
        "overflow-x-auto rounded-xl border border-slate-200 bg-white transition-opacity",
        loading ? "opacity-60" : "opacity-100",
      ].join(" ")}
    >
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Event Edition</th>
            <th className="w-16 px-4 py-3 font-medium">Event Series</th>
            <th className="px-4 py-3 font-medium">Venue</th>
            <th className="px-4 py-3 font-medium">Last reviewed</th>
            <th className="px-4 py-3 font-medium">Organizers</th>
            <th className="px-4 py-3 font-medium">Sponsors</th>
            <th className="px-4 py-3 font-medium">Exhibitors</th>
          </tr>
        </thead>
        <tbody>
          {editions.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No event editions found.
              </td>
            </tr>
          ) : (
            editions.map((edition) => {
              const detailHref = `/admin/events/editions/${edition.id}`;

              return (
                <tr
                  key={edition.id}
                  className="relative border-b border-slate-100 last:border-0 hover:bg-brand-primary-muted/50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link
                      href={detailHref}
                      className={[
                        "text-slate-900 hover:underline",
                        "after:absolute after:inset-0 after:z-[1] after:content-['']",
                        "focus-visible:relative focus-visible:z-[2] focus-visible:outline-none",
                        "focus-visible:ring-2 focus-visible:ring-brand-primary/25 focus-visible:ring-offset-2",
                      ].join(" ")}
                    >
                      {edition.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {edition.event_series ? (
                      <SeriesLogo
                        series={edition.event_series}
                        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                        monogramClassName="text-xs font-semibold text-slate-400"
                      />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PresenceMark
                      present={editionHasAssignedVenue(edition)}
                      label="Has venue"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <PresenceMark
                      present={editionHasLastReviewed(edition.last_reviewed_at)}
                      label="Has last reviewed date"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{edition.organizer_count}</td>
                  <td className="px-4 py-3">
                    <PresenceMark
                      present={editionHasSponsors(edition.live_sponsor_count)}
                      label="Has sponsors"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <PresenceMark
                      present={editionHasExhibitors(edition.exhibitor_count)}
                      label="Has exhibitors"
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
