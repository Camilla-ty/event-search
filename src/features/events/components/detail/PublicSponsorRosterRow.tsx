import Link from "next/link";

import { Badge } from "@/src/components/common";
import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import {
  isCompanyRestricted,
  RESTRICTED_COMPANY_ROSTER_LABEL,
} from "@/src/lib/companies/companyPublicRestriction";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import type { EventSponsorRow } from "./types";

type PublicSponsorRosterRowProps = {
  sponsor: EventSponsorRow;
  /** When true, show the stored tier_label as a subtle badge (search results). */
  showTierLabel?: boolean;
};

export function PublicSponsorRosterRow({
  sponsor,
  showTierLabel = false,
}: PublicSponsorRosterRowProps) {
  const company = sponsor.companies;
  const restricted = isCompanyRestricted(company);
  const companyName = company?.name?.trim() || "Unknown sponsor";
  const domain = restricted ? null : company?.domain?.trim() || null;
  const profileHref = company ? buildSponsorProfilePath(company) : null;
  // Exact stored label only — no rank→name normalization. Blank/null → no badge.
  const tierLabel =
    showTierLabel &&
    typeof sponsor.tier_label === "string" &&
    sponsor.tier_label.trim() !== ""
      ? sponsor.tier_label
      : null;
  const logoFields = companyLogoFieldsFromRow(
    restricted && company
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
      {company ? (
        <CompanyLogo
          company={logoFields}
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5"
          monogramClassName="text-sm font-semibold text-slate-400"
          alt=""
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
          <span className="text-sm font-semibold text-slate-400">?</span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <p className="truncate font-medium text-slate-900">{companyName}</p>
          {tierLabel ? (
            <Badge
              variant="neutral"
              className="w-fit max-w-full truncate px-1.5 py-0 text-[11px] font-medium text-slate-600"
            >
              {tierLabel}
            </Badge>
          ) : null}
        </div>
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
