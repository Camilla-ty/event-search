import Link from "next/link";

import type { CompanySponsorshipRow } from "@/src/features/companies/server/companySponsorshipAdmin";

type CompanySponsorshipsTableProps = {
  sponsorships: CompanySponsorshipRow[];
};

export function CompanySponsorshipsTable({
  sponsorships,
}: CompanySponsorshipsTableProps) {
  if (sponsorships.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        This company is not a sponsor of any edition yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Event</th>
            <th className="px-4 py-3 font-medium">Series</th>
            <th className="px-4 py-3 font-medium">Tier label</th>
            <th className="px-4 py-3 font-medium">Rank</th>
          </tr>
        </thead>
        <tbody>
          {sponsorships.map((row) => {
            const edition = row.edition;
            const series = row.series;
            const label =
              typeof row.tier_label === "string" && row.tier_label.trim() !== ""
                ? row.tier_label.trim()
                : null;
            return (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {edition ? (
                    <Link
                      href={`/admin/events/editions/${edition.id}?tab=sponsors`}
                      className="text-brand-primary hover:underline"
                    >
                      {edition.name}
                      {edition.year !== null ? ` (${edition.year})` : ""}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {series ? (
                    <Link
                      href={`/admin/events/series/${series.id}`}
                      className="text-brand-primary hover:underline"
                    >
                      {series.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{label ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{row.tier_rank ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
