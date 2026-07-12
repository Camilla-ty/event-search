"use client";

import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { InlineErrorBanner, LoadingStatus } from "@/src/components/common";
import { useAdminVenuesCollection } from "@/src/features/venues/client/useAdminVenuesCollection";
import type { AdminVenuesCollectionResult } from "@/src/features/venues/server/adminVenuesCollection";
import { primaryCtaClass } from "@/src/lib/design/classes";

import { AdminVenuesIncludeArchivedToggle } from "./AdminVenuesIncludeArchivedToggle";
import { AdminVenuesListTable } from "./AdminVenuesListTable";
import { AdminVenuesSearchForm } from "./AdminVenuesSearchForm";

type AdminVenuesPageProps = {
  initial: AdminVenuesCollectionResult;
};

function buildPageDescription(
  search: string,
  includeArchived: boolean,
  total: number,
): string {
  if (search !== "") {
    return `Search: “${search}” (${total})`;
  }
  if (includeArchived) {
    return `All venues including archived (${total})`;
  }
  return "Reusable event locations linked to editions.";
}

export function AdminVenuesPage({ initial }: AdminVenuesPageProps) {
  const {
    venues,
    total,
    params,
    isLoading,
    error,
    submitSearch,
    clearSearch,
    toggleIncludeArchived,
  } = useAdminVenuesCollection(initial);

  return (
    <section>
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Venues" }]}
      />
      <AdminPageHeader
        title="Venues"
        description={buildPageDescription(params.search, params.includeArchived, total)}
        actions={
          <Link href="/admin/venues/new" className={`${primaryCtaClass} h-10`}>
            Create venue
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <AdminVenuesIncludeArchivedToggle
          includeArchived={params.includeArchived}
          onToggle={toggleIncludeArchived}
        />
      </div>

      <AdminVenuesSearchForm
        search={params.search}
        onSubmit={submitSearch}
        onClear={clearSearch}
      />

      {error !== null ? <InlineErrorBanner message={error} /> : null}
      {isLoading && venues.length > 0 ? (
        <LoadingStatus message="Updating results…" />
      ) : null}

      <AdminVenuesListTable
        venues={venues}
        loading={isLoading && venues.length > 0}
      />
    </section>
  );
}
