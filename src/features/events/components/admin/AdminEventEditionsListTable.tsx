import Link from "next/link";

import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import type { EventEditionListItem } from "@/src/features/events/server/eventEditionAdmin";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";

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
            <th className="px-4 py-3 font-medium">Event</th>
            <th className="px-4 py-3 font-medium">Event brand</th>
            <th className="px-4 py-3 font-medium">Year</th>
            <th className="px-4 py-3 font-medium">City</th>
            <th className="px-4 py-3 font-medium">Live sponsors</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {editions.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No events found.
              </td>
            </tr>
          ) : (
            editions.map((edition) => (
              <tr key={edition.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{edition.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="flex items-center gap-2">
                    <SeriesLogo
                      series={edition.event_series}
                      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                      monogramClassName="text-xs font-semibold text-slate-400"
                    />
                    <span>{edition.event_series?.name ?? "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{edition.year}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatLocationFromCityEmbed(edition.cities) || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{edition.live_sponsor_count}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/events/editions/${edition.id}`}
                    className="text-brand-primary hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
