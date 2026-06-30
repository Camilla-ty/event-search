import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import { formatEventSponsorWebsiteSubtitle } from "./eventSponsorUtils";
import type { EventSponsorRow } from "./types";

type EventSponsorListItemProps = {
  sponsor: EventSponsorRow;
  variant?: "default" | "grouped";
};

export function EventSponsorListItem({
  sponsor,
  variant = "default",
}: EventSponsorListItemProps) {
  const company = sponsor.companies;
  const heading = company?.name?.trim() || "Unknown sponsor";
  const subtitle = formatEventSponsorWebsiteSubtitle(company);
  const profileHref = company
    ? buildSponsorProfilePath({ slug: company.slug, id: company.id })
    : null;
  const grouped = variant === "grouped";

  const groupedItemClass =
    "flex min-h-[5.5rem] gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2";

  if (!profileHref) {
    return (
      <li className="min-w-0">
        <div className={grouped ? groupedItemClass : "rounded-lg border border-slate-200 p-3"}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug text-slate-900">{heading}</p>
            {subtitle ? (
              <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="min-w-0">
      <Link
        href={profileHref}
        className={
          grouped
            ? groupedItemClass
            : "block rounded-lg border border-slate-200 p-3 transition hover:border-brand-primary/40 hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
        }
      >
        <div className="flex min-w-0 flex-1 gap-4">
          <CompanyLogo
            company={companyLogoFieldsFromRow(company)}
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white sm:h-14 sm:w-14"
            monogramClassName="text-lg font-semibold text-slate-400"
          />
          <div className="min-w-0 flex-1 self-center">
            <p className="font-semibold leading-snug text-slate-900">{heading}</p>
            {subtitle ? (
              <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
