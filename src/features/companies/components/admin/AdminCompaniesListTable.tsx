"use client";

import { type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { AdminCompanyLogoCell } from "@/src/features/companies/components/admin/AdminCompanyLogoCell";
import { AdminCompanySearchMatchHint } from "@/src/features/companies/components/admin/AdminCompanySearchMatchHint";
import type { CompanyListFilter } from "@/src/features/companies/server/companyAdmin";

export type AdminCompaniesListRow = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  sponsor_link_count: number;
  matched_alias?: string | null;
};

type AdminCompaniesListTableProps = {
  companies: AdminCompaniesListRow[];
  filter: CompanyListFilter;
  loading?: boolean;
};

function tableColumnCount(filter: CompanyListFilter): number {
  return filter === "needs_logo_review" ? 5 : 4;
}

type AdminCompaniesListTableRowProps = {
  company: AdminCompaniesListRow;
  showWebsite: boolean;
};

function AdminCompaniesListTableRow({
  company,
  showWebsite,
}: AdminCompaniesListTableRowProps) {
  const router = useRouter();
  const detailHref = `/admin/companies/${company.id}`;
  const companyName = company.name.trim() !== "" ? company.name.trim() : "Unknown company";

  function navigateToDetail() {
    router.push(detailHref);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToDetail();
    }
  }

  return (
    <tr
      onClick={navigateToDetail}
      onKeyDown={handleRowKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`View company: ${companyName}`}
      className={[
        "cursor-pointer border-b border-slate-100 last:border-0",
        "hover:bg-brand-primary-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/25 focus-visible:ring-inset",
      ].join(" ")}
    >
      <td className="px-4 py-3 align-top">
        <AdminCompanyLogoCell
          name={company.name}
          logoUrl={company.logo_url}
          logoSource={company.logo_source}
        />
      </td>
      <td className="px-4 py-3 font-medium text-slate-900">
        <div>{company.name}</div>
        <AdminCompanySearchMatchHint
          matchedAlias={company.matched_alias}
          className="mt-0.5 block"
        />
      </td>
      <td className="px-4 py-3 text-slate-600">{company.domain ?? "—"}</td>
      {showWebsite ? (
        <td className="max-w-xs truncate px-4 py-3 text-slate-600">
          {company.website ?? "—"}
        </td>
      ) : null}
      <td className="px-4 py-3 text-slate-600">{company.sponsor_link_count}</td>
    </tr>
  );
}

export function AdminCompaniesListTable({
  companies,
  filter,
  loading = false,
}: AdminCompaniesListTableProps) {
  const showWebsite = filter === "needs_logo_review";

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
            <th className="w-20 px-4 py-3 font-medium">Logo</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Domain</th>
            {showWebsite ? (
              <th className="px-4 py-3 font-medium">Website</th>
            ) : null}
            <th className="px-4 py-3 font-medium">Event links</th>
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
              <AdminCompaniesListTableRow
                key={company.id}
                company={company}
                showWebsite={showWebsite}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
