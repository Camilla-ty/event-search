import Link from "next/link";

import { eventSeriesAdminHref } from "@/src/features/companies/server/companyExhibitorAdmin";
import type { CompanyPartnerAlumniRow } from "@/src/features/companies/server/companyPartnerAlumniAdmin";

type CompanyPartnerAlumniTableProps = {
  partnerAlumni: CompanyPartnerAlumniRow[];
};

export function CompanyPartnerAlumniTable({
  partnerAlumni,
}: CompanyPartnerAlumniTableProps) {
  if (partnerAlumni.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        This company is not on a current Partner Alumni roster.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Event Series</th>
            <th className="px-4 py-3 font-medium">Event Editions</th>
          </tr>
        </thead>
        <tbody>
          {partnerAlumni.map((row) => (
            <tr key={row.programId} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-900">
                {row.series ? (
                  <Link
                    href={eventSeriesAdminHref(row.series.id)}
                    className="text-brand-primary hover:underline"
                  >
                    {row.series.name}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {row.editions.length === 0 ? (
                  "No event editions"
                ) : (
                  <ul className="space-y-1">
                    {row.editions.map((edition) => (
                      <li key={edition.id}>
                        <Link
                          href={`/admin/events/editions/${edition.id}`}
                          className="text-brand-primary hover:underline"
                        >
                          {edition.name}
                          {edition.year !== null ? ` (${edition.year})` : ""}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
