import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

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
  const shortRaw = company?.short_description?.trim();
  const profileHref = company
    ? buildSponsorProfilePath({ slug: company.slug, id: company.id })
    : null;
  const grouped = variant === "grouped";

  if (!profileHref) {
    return (
      <li className={grouped ? "px-4 py-3" : "rounded-lg border border-slate-200 p-3"}>
        <p className="font-semibold text-slate-900">{heading}</p>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={profileHref}
        className={
          grouped
            ? "block px-4 py-3 transition hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-inset"
            : "block rounded-lg border border-slate-200 p-3 transition hover:border-brand-primary/40 hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
        }
      >
        <div className="flex gap-3">
          <CompanyLogo
            company={companyLogoFieldsFromRow(company)}
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white"
            monogramClassName="text-lg font-semibold text-slate-400"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{heading}</p>
            {shortRaw ? (
              <p className="line-clamp-2 text-sm text-slate-600">{shortRaw}</p>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
