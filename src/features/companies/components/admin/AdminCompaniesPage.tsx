"use client";

import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { InlineErrorBanner, LoadingStatus } from "@/src/components/common";
import { useAdminCompaniesCollection } from "@/src/features/companies/client/useAdminCompaniesCollection";
import type { AdminCompaniesCollectionResult } from "@/src/features/companies/server/adminCompaniesCollection";
import { primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";

import {
  AdminCompaniesFilterChips,
  companyListFilterLabel,
} from "./AdminCompaniesFilterChips";
import { AdminCompaniesListSkeleton } from "./AdminCompaniesListSkeleton";
import { AdminCompaniesListTable } from "./AdminCompaniesListTable";
import { AdminCompaniesSearchForm } from "./AdminCompaniesSearchForm";

type AdminCompaniesPageProps = {
  initial: AdminCompaniesCollectionResult;
};

function buildPageDescription(
  search: string,
  filter: AdminCompaniesCollectionResult["params"]["filter"],
  total: number,
): string {
  if (search !== "") {
    return `Search: “${search}” (${total})`;
  }
  if (filter === "all") {
    return "Global sponsor directory.";
  }
  return `${companyListFilterLabel(filter)} (${total})`;
}

export function AdminCompaniesPage({ initial }: AdminCompaniesPageProps) {
  const {
    companies,
    total,
    params,
    isLoading,
    error,
    setFilter,
    submitSearch,
    clearSearch,
  } = useAdminCompaniesCollection(initial);

  const showInitialSkeleton = isLoading && companies.length === 0;
  const showRefreshingState = isLoading && companies.length > 0;

  return (
    <section>
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Companies" }]}
      />
      <AdminPageHeader
        title="Companies"
        description={buildPageDescription(params.search, params.filter, total)}
        actions={
          <>
            <Link href="/admin/companies/merge" className={`${secondaryCtaClass} h-10`}>
              Merge duplicates
            </Link>
            <Link href="/admin/companies/new" className={`${primaryCtaClass} h-10`}>
              Create company
            </Link>
          </>
        }
      />

      <AdminCompaniesFilterChips filter={params.filter} onFilterChange={setFilter} />

      <AdminCompaniesSearchForm
        search={params.search}
        onSubmit={submitSearch}
        onClear={clearSearch}
      />

      {error !== null ? <InlineErrorBanner message={error} /> : null}
      {showRefreshingState ? <LoadingStatus message="Updating results…" /> : null}

      {showInitialSkeleton ? (
        <AdminCompaniesListSkeleton filter={params.filter} />
      ) : (
        <AdminCompaniesListTable
          companies={companies}
          filter={params.filter}
          loading={showRefreshingState}
        />
      )}
    </section>
  );
}
