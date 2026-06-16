import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { AdminCompaniesListTable } from "@/src/features/companies/components/admin/AdminCompaniesListTable";
import {
  listCompaniesAdmin,
  type CompanyListFilter,
} from "@/src/features/companies/server/companyAdmin";
import { primaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

const FILTER_OPTIONS: Array<{ value: CompanyListFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "social_website", label: "Social website" },
  { value: "missing_logo", label: "Missing logo" },
  { value: "needs_logo_review", label: "Needs logo review" },
];

function parseFilter(value: string | undefined): CompanyListFilter {
  if (
    value === "social_website" ||
    value === "missing_logo" ||
    value === "needs_logo_review"
  ) {
    return value;
  }
  return "all";
}

function filterHref(filter: CompanyListFilter): string {
  if (filter === "all") return "/admin/companies";
  return `/admin/companies?filter=${filter}`;
}

export default async function AdminCompaniesListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filter = parseFilter(params.filter);
  const companies = await listCompaniesAdmin({ filter });

  const activeFilterLabel =
    FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? "All";

  return (
    <section>
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Companies" }]}
      />
      <AdminPageHeader
        title="Companies"
        description={
          filter === "all"
            ? "Global sponsor directory."
            : `${activeFilterLabel} (${companies.length})`
        }
        actions={
          <Link href="/admin/companies/new" className={`${primaryCtaClass} h-10`}>
            Create company
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => {
          const active = option.value === filter;
          return (
            <Link
              key={option.value}
              href={filterHref(option.value)}
              className={
                active
                  ? "rounded-full bg-brand-primary px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <AdminCompaniesListTable
        filter={filter}
        companies={companies.map((company) => ({
          id: company.id,
          name: company.name,
          domain: company.domain,
          website: company.website,
          logo_url: company.logo_url,
          logo_source: company.logo_source,
          logo_status: company.logo_status,
          sponsor_link_count: company.sponsor_link_count,
        }))}
      />
    </section>
  );
}
