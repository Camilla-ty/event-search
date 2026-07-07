import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import type { EventSponsorRow } from "./types";

function publicTierLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

type EventSponsorListItemProps = {
  sponsor: EventSponsorRow;
  variant?: "default" | "compact";
};

export function EventSponsorListItem({
  sponsor,
  variant = "default",
}: EventSponsorListItemProps) {
  const company = sponsor.companies;
  const tierLabel = publicTierLabel(sponsor.tier_label);
  const heading = company?.name?.trim() || "Unknown sponsor";
  const shortRaw = company?.short_description?.trim();
  const profileHref = company
    ? buildSponsorProfilePath({ slug: company.slug, id: company.id })
    : null;

  if (variant === "compact") {
    if (!profileHref) {
      return (
        <li className="flex items-center gap-3 py-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
            <span className="text-xs font-semibold text-slate-400">?</span>
          </div>
          <p className="min-w-0 truncate font-medium text-slate-900">{heading}</p>
        </li>
      );
    }

    return (
      <li>
        <Link
          href={profileHref}
          className="flex items-center gap-3 rounded-lg py-1 transition hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
        >
          <CompanyLogo
            company={companyLogoFieldsFromRow(company)}
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white"
            monogramClassName="text-sm font-semibold text-slate-400"
            alt=""
          />
          <p className="min-w-0 truncate font-medium text-slate-900">{heading}</p>
        </Link>
      </li>
    );
  }

  if (!profileHref) {
    return (
      <li className="rounded-lg border border-slate-200 p-3">
        <p className="font-semibold text-slate-900">{heading}</p>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={profileHref}
        className="block rounded-lg border border-slate-200 p-3 transition hover:border-brand-primary/40 hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
      >
        <div className="flex gap-3">
          <CompanyLogo
            company={companyLogoFieldsFromRow(company)}
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white"
            monogramClassName="text-lg font-semibold text-slate-400"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-900">{heading}</p>
              {tierLabel ? (
                <span className="shrink-0 text-xs font-medium text-slate-500">{tierLabel}</span>
              ) : null}
            </div>
            {shortRaw ? (
              <p className="line-clamp-2 text-sm text-slate-600">{shortRaw}</p>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
