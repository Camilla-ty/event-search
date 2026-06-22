"use client";

import { AdminCompanyLogoCell } from "@/src/features/companies/components/admin/AdminCompanyLogoCell";
import { AdminCompanySearchMatchHint } from "@/src/features/companies/components/admin/AdminCompanySearchMatchHint";
import type { MergeCompanyPickerOption } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";

type MergeCompanyCompareCardProps = {
  company: MergeCompanyPickerOption;
  badge?: string;
  highlight?: boolean;
};

export function MergeCompanyCompareCard({
  company,
  badge,
  highlight = false,
}: MergeCompanyCompareCardProps) {
  return (
    <div
      className={[
        "rounded-xl border bg-white p-4",
        highlight ? "border-brand-primary ring-2 ring-brand-primary/15" : "border-slate-200",
      ].join(" ")}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AdminCompanyLogoCell
            name={company.name}
            logoUrl={company.logo_url}
            logoSource={null}
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{company.name}</p>
            {company.domain ? (
              <p className="truncate text-sm text-slate-500">{company.domain}</p>
            ) : (
              <p className="text-sm text-slate-400">No domain</p>
            )}
            {company.matched_alias ? (
              <AdminCompanySearchMatchHint
                matchedAlias={company.matched_alias}
                className="mt-1 block"
              />
            ) : null}
          </div>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {badge}
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase text-slate-500">Slug</dt>
          <dd className="font-mono text-slate-800">{company.slug || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-500">Sponsorships</dt>
          <dd className="text-slate-800">{company.sponsor_link_count}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase text-slate-500">Website</dt>
          <dd className="truncate text-slate-800">{company.website ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
