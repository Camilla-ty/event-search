"use client";

import Link from "next/link";

type AdminVenuesIncludeArchivedToggleProps = {
  includeArchived: boolean;
  search: string;
};

function buildVenuesListPath(search: string, includeArchived: boolean): string {
  const params = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed !== "") params.set("search", trimmed);
  if (includeArchived) params.set("includeArchived", "true");
  const query = params.toString();
  return query ? `/admin/venues?${query}` : "/admin/venues";
}

export function AdminVenuesIncludeArchivedToggle({
  includeArchived,
  search,
}: AdminVenuesIncludeArchivedToggleProps) {
  const nextIncludeArchived = !includeArchived;

  return (
    <Link
      href={buildVenuesListPath(search, nextIncludeArchived)}
      className={
        includeArchived
          ? "rounded-full bg-brand-primary px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      }
    >
      {includeArchived ? "Showing archived" : "Show archived"}
    </Link>
  );
}
