"use client";

import Link from "next/link";

import { Badge, Button } from "@/src/components/common";
import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import type { SponsorRecord } from "./types";

function publicTierLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

export function SponsorCard({ sponsor }: { sponsor: SponsorRecord }) {
  const companyName = sponsor.companies?.name ?? "Unknown Sponsor";
  const industry = sponsor.companies?.industry ?? "Industry not set";
  const location = sponsor.companies?.location ?? "Location not set";
  const tierLabel = publicTierLabel(sponsor.tier_label);
  const profileHref = sponsor.companies
    ? buildSponsorProfilePath({
        slug: sponsor.companies.slug,
        id: sponsor.companies.id,
      })
    : null;

  return (
    <article className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[auto_1fr_auto] md:items-center">
      <CompanyLogo
        company={companyLogoFieldsFromRow(sponsor.companies)}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        monogramClassName="text-lg font-semibold text-slate-400"
      />

      <div className="space-y-2 min-w-0">
        <h3 className="text-base font-semibold text-slate-900">{companyName}</h3>
        <p className="text-sm text-slate-600">{industry}</p>
        <p className="text-xs text-slate-500">{location}</p>
        {tierLabel ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{tierLabel}</Badge>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-start md:justify-end">
        {profileHref ? (
          <Link
            href={profileHref}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
          >
            View Profile
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            View Profile
          </Button>
        )}
      </div>
    </article>
  );
}
