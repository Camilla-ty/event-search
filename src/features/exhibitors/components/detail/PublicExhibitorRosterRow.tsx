import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import type { PublicExhibitorRow } from "@/src/features/exhibitors/server/exhibitorsPublic";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import {
  isCompanyRestricted,
  RESTRICTED_COMPANY_ROSTER_LABEL,
} from "@/src/lib/companies/companyPublicRestriction";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

type PublicExhibitorRosterRowProps = {
  exhibitor: PublicExhibitorRow;
};

export function PublicExhibitorRosterRow({ exhibitor }: PublicExhibitorRosterRowProps) {
  const company = exhibitor.company;
  const restricted = isCompanyRestricted(company);
  const companyName = company.name?.trim() || "Unknown exhibitor";
  const domain = restricted ? null : company.domain?.trim() || null;
  const profileHref = buildSponsorProfilePath(company);
  const logoFields = companyLogoFieldsFromRow(
    restricted
      ? {
          name: company.name,
          domain: null,
          logo_url: null,
          logo_source: null,
          logo_status: null,
        }
      : company,
  );

  const content = (
    <div className="flex items-center gap-3">
      <CompanyLogo
        company={logoFields}
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5"
        monogramClassName="text-sm font-semibold text-slate-400"
        alt=""
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="truncate font-medium text-slate-900">{companyName}</p>
        {restricted ? (
          <p className="truncate text-xs text-slate-500 sm:max-w-[40%] sm:shrink-0 sm:text-right">
            {RESTRICTED_COMPANY_ROSTER_LABEL}
          </p>
        ) : domain ? (
          <p className="truncate text-sm text-slate-500 sm:max-w-[40%] sm:shrink-0 sm:text-right">
            {domain}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!profileHref) {
    return <li className="border-b border-slate-100 px-4 py-2.5 last:border-0">{content}</li>;
  }

  return (
    <li className="border-b border-slate-100 last:border-0">
      <Link
        href={profileHref}
        className="block px-4 py-2.5 transition hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    </li>
  );
}
