"use client";

import Link from "next/link";

import { Badge, Button } from "@/src/components/common";

import type { SponsorRecord } from "./types";

export function SponsorCard({ sponsor }: { sponsor: SponsorRecord }) {
  const companyName = sponsor.companies?.name ?? "Unknown Sponsor";
  const industry = sponsor.companies?.industry ?? "Industry not set";
  const location = sponsor.companies?.location ?? "Location not set";
  const tierLabel =
    sponsor.tier_rank !== null && sponsor.tier_rank !== undefined
      ? String(sponsor.tier_rank)
      : "—";
  const slug = sponsor.companies?.slug?.trim() ?? "";
  const companyId = sponsor.companies?.id?.trim() ?? "";
  const segment = slug || companyId || "";
  const profileHref = segment !== "" ? `/sponsors/${encodeURIComponent(segment)}` : null;

  return (
    <article className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[2fr_1fr_auto] md:items-center dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{companyName}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">{industry}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{location}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Active</Badge>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Tier rank: {tierLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
          {tierLabel}
        </div>
      </div>

      <div className="flex items-center justify-start md:justify-end">
        {profileHref ? (
          <Link
            href={profileHref}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
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
