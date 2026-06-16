import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { AdminCompanyLogoCell } from "@/src/features/companies/components/admin/AdminCompanyLogoCell";
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

function tableColumnCount(filter: CompanyListFilter): number {
  return filter === "needs_logo_review" ? 6 : 5;
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-20 px-4 py-3 font-medium">Logo</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Domain</th>
              {filter === "needs_logo_review" ? (
                <th className="px-4 py-3 font-medium">Website</th>
              ) : null}
              <th className="px-4 py-3 font-medium">Event links</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumnCount(filter)}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No companies match this filter.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr key={company.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 align-top">
                    <AdminCompanyLogoCell
                      name={company.name}
                      logoUrl={company.logo_url}
                      logoSource={company.logo_source}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{company.name}</td>
                  <td className="px-4 py-3 text-slate-600">{company.domain ?? "—"}</td>
                  {filter === "needs_logo_review" ? (
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600">
                      {company.website ?? "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-slate-600">{company.sponsor_link_count}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/companies/${company.id}`}
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
    </section>
  );
}
