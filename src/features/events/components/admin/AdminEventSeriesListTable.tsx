import Link from "next/link";

import { Badge } from "@/src/components/common";
import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import {
  eventSeriesListLifecycleBadge,
  formatEventSeriesListWebsiteHost,
} from "@/src/features/events/components/admin/adminEventSeriesListDisplay";
import type { EventSeriesListItem } from "@/src/features/events/server/eventSeriesAdmin";

type AdminEventSeriesListTableProps = {
  series: EventSeriesListItem[];
};

export function AdminEventSeriesListTable({ series }: AdminEventSeriesListTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="w-[11rem] max-w-[11rem] px-4 py-3 font-medium">Event Series</th>
            <th className="px-4 py-3 font-medium">Website</th>
            <th className="px-4 py-3 font-medium">Lifecycle</th>
            <th className="w-20 px-4 py-3 font-medium">Logo</th>
            <th className="px-4 py-3 font-medium">SEO</th>
            <th className="px-4 py-3 font-medium">Editions</th>
          </tr>
        </thead>
        <tbody>
          {series.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No event series yet.{" "}
                <Link href="/admin/events/series/new" className="text-brand-primary underline">
                  Create one
                </Link>
              </td>
            </tr>
          ) : (
            series.map((row) => {
              const detailHref = `/admin/events/series/${row.id}`;
              const websiteHost = formatEventSeriesListWebsiteHost(row.website_url);
              const lifecycle = eventSeriesListLifecycleBadge(row.lifecycle_status);

              return (
                <tr
                  key={row.id}
                  className="relative border-b border-slate-100 last:border-0 hover:bg-brand-primary-muted/50"
                >
                  <td className="w-[11rem] max-w-[11rem] px-4 py-3 font-medium text-slate-900">
                    <Link
                      href={detailHref}
                      className={[
                        "whitespace-normal break-words text-slate-900 hover:underline",
                        "after:absolute after:inset-0 after:z-[1] after:content-['']",
                        "focus-visible:relative focus-visible:z-[2] focus-visible:outline-none",
                        "focus-visible:ring-2 focus-visible:ring-brand-primary/25 focus-visible:ring-offset-2",
                      ].join(" ")}
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-600">
                    {websiteHost ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={lifecycle.variant}>{lifecycle.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <SeriesLogo
                      series={{ name: row.name, logo_url: row.logo_url }}
                      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-1"
                      imageClassName="max-h-full max-w-full object-contain"
                      monogramClassName="text-sm font-semibold text-slate-400"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.has_keywords ? (
                      <span aria-label="Has keywords">✓</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.edition_count}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
