import Link from "next/link";

import { Badge } from "@/src/components/common";
import type { VenueListItem } from "@/src/features/venues/server/venueAdmin";
import { resolveStorageLogoDisplayUrl } from "@/src/lib/storage/resolveStorageLogoDisplayUrl";

type AdminVenuesListTableProps = {
  venues: VenueListItem[];
  loading?: boolean;
};

function VenueLogoCell({ logoUrl }: { logoUrl: string | null }) {
  const trimmed = resolveStorageLogoDisplayUrl(logoUrl) ?? "";
  if (trimmed === "") {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-white p-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={trimmed} alt="" className="max-h-full max-w-full object-contain" />
    </div>
  );
}

export function AdminVenuesListTable({ venues, loading = false }: AdminVenuesListTableProps) {
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
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">City</th>
            <th className="px-4 py-3 font-medium">Linked events</th>
            <th className="px-4 py-3 font-medium">Logo</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {venues.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No venues found.{" "}
                <Link href="/admin/venues/new" className="text-brand-primary underline">
                  Create one
                </Link>
              </td>
            </tr>
          ) : (
            venues.map((venue) => {
              const isArchived = venue.archived_at !== null;
              return (
                <tr key={venue.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{venue.name}</td>
                  <td className="px-4 py-3 text-slate-600">{venue.city_label}</td>
                  <td className="px-4 py-3 text-slate-600">{venue.linked_edition_count}</td>
                  <td className="px-4 py-3">
                    <VenueLogoCell logoUrl={venue.logo_url} />
                  </td>
                  <td className="px-4 py-3">
                    {isArchived ? (
                      <Badge variant="neutral">Archived</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/venues/${venue.id}`}
                      className="text-brand-primary hover:underline"
                    >
                      View
                    </Link>
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
