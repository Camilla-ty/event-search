"use client";

import Link from "next/link";

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
};

function tableColumnCount(filter: CompanyListFilter): number {
  return filter === "needs_logo_review" ? 6 : 5;
}

export function AdminCompaniesListTable({ companies, filter }: AdminCompaniesListTableProps) {
  return (
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
                <td className="px-4 py-3 font-medium text-slate-900">
                  <div>{company.name}</div>
                  <AdminCompanySearchMatchHint
                    matchedAlias={company.matched_alias}
                    className="mt-0.5 block"
                  />
                </td>
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
  );
}
