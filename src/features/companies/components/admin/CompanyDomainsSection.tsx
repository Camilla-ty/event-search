import type { CompanyDomainAdminRow } from "@/src/features/companies/server/companyDomainsAdmin";

type CompanyDomainsSectionProps = {
  domains: CompanyDomainAdminRow[];
};

export function CompanyDomainsSection({ domains }: CompanyDomainsSectionProps) {
  if (domains.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Company Domains</h2>
      <p className="mb-3 text-sm text-slate-500">
        Internal identity data for matching. Not shown on public company profiles.
      </p>
      <ul className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
        {domains.map((row) => (
          <li key={row.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
            <span className="font-medium">{row.domain}</span>
            <span className="text-slate-500">{row.is_primary ? "Primary" : "Additional"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
