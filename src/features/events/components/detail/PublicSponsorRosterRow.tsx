import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import type { EventSponsorRow } from "./types";

type PublicSponsorRosterRowProps = {
  sponsor: EventSponsorRow;
};

export function PublicSponsorRosterRow({ sponsor }: PublicSponsorRosterRowProps) {
  const company = sponsor.companies;
  const companyName = company?.name?.trim() || "Unknown sponsor";
  const domain = company?.domain?.trim() || null;
  const profileHref = company
    ? buildSponsorProfilePath({ slug: company.slug, id: company.id })
    : null;

  const content = (
    <div className="flex gap-4">
      {company ? (
        <CompanyLogo
          company={companyLogoFieldsFromRow(company)}
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-2"
          monogramClassName="text-xl font-semibold text-slate-400"
          alt=""
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
          <span className="text-xl font-semibold text-slate-400">?</span>
        </div>
      )}
      <div className="min-w-0 flex-1 pt-1">
        <p className="font-medium text-slate-900">{companyName}</p>
        {domain ? <p className="text-sm text-slate-500">{domain}</p> : null}
      </div>
    </div>
  );

  if (!profileHref) {
    return <li className="border-b border-slate-100 px-4 py-3 last:border-0">{content}</li>;
  }

  return (
    <li className="border-b border-slate-100 last:border-0">
      <Link
        href={profileHref}
        className="block px-4 py-3 transition hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    </li>
  );
}
