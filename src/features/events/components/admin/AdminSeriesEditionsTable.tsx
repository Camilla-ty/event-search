import Link from "next/link";

import type { EventEditionListItem } from "@/src/features/events/server/eventEditionAdmin";

export function formatSeriesEditionReviewedMark(
  lastReviewedAt: string | null | undefined,
): string {
  return lastReviewedAt ? "✓" : "—";
}

export function formatSeriesEditionVenueName(
  venues: EventEditionListItem["venues"],
): string {
  const name = venues?.name?.trim();
  return name && name.length > 0 ? name : "—";
}

type AdminSeriesEditionsTableProps = {
  editions: EventEditionListItem[];
};

export function AdminSeriesEditionsTable({ editions }: AdminSeriesEditionsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Venue</th>
            <th className="px-4 py-3">Reviewed</th>
            <th className="px-4 py-3">Live Sponsors</th>
            <th className="px-4 py-3">Organizers</th>
          </tr>
        </thead>
        <tbody>
          {editions.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                No event editions for this event series yet.
              </td>
            </tr>
          ) : (
            editions.map((edition) => (
              <tr key={edition.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/events/editions/${edition.id}`}
                    className="font-medium text-brand-primary hover:underline"
                  >
                    {edition.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatSeriesEditionVenueName(edition.venues)}</td>
                <td className="px-4 py-3">
                  {formatSeriesEditionReviewedMark(edition.last_reviewed_at)}
                </td>
                <td className="px-4 py-3">{edition.live_sponsor_count}</td>
                <td className="px-4 py-3">{edition.organizer_count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
