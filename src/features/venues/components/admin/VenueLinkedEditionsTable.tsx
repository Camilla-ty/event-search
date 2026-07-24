import Link from "next/link";

import type { VenueLinkedEditionRow } from "@/src/features/venues/server/venueAdmin";

type VenueLinkedEditionsTableProps = {
  editions: VenueLinkedEditionRow[];
};

export function VenueLinkedEditionsTable({ editions }: VenueLinkedEditionsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Year</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {editions.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                No events linked to this venue yet.
              </td>
            </tr>
          ) : (
            editions.map((edition) => (
              <tr key={edition.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{edition.name}</td>
                <td className="px-4 py-3 text-slate-600">{edition.year}</td>
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
