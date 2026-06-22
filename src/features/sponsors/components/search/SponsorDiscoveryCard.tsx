"use client";

import Link from "next/link";

import { Badge, Button } from "@/src/components/common";
import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import type { SponsorDiscoveryRow } from "./discoveryTypes";

function publicTierLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

function activityYearFromIso(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 4) return null;
  const year = Number.parseInt(trimmed.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function formatEditionCount(count: number): string {
  const value = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return `${value.toLocaleString()} ${value === 1 ? "event" : "events"}`;
}

type SponsorDiscoveryCardProps = {
  row: SponsorDiscoveryRow;
  /** When true, show tier_label badge if event_tier is present (event-filter mode only). */
  showEventTier?: boolean;
};

export function SponsorDiscoveryCard({
  row,
  showEventTier = false,
}: SponsorDiscoveryCardProps) {
  const companyName = row.name.trim() !== "" ? row.name.trim() : "Unknown Sponsor";
  const location =
    row.location_label?.trim() !== "" ? row.location_label?.trim() : "Location not set";
  const shortDescription = row.short_description?.trim() ?? "";
  const activityYear = activityYearFromIso(row.latest_activity_at);
  const tierLabel =
    showEventTier && row.event_tier !== null
      ? publicTierLabel(row.event_tier.tier_label)
      : null;
  const profileHref = buildSponsorProfilePath({ slug: row.slug, id: row.id });

  const metaParts: string[] = [formatEditionCount(row.sponsored_edition_count)];
  if (activityYear !== null) {
    metaParts.push(`Active ${activityYear}`);
  }

  return (
    <article className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[auto_1fr_auto] md:items-center">
      <CompanyLogo
        company={companyLogoFieldsFromRow(row)}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        monogramClassName="text-lg font-semibold text-slate-400"
      />

      <div className="min-w-0 space-y-2">
        <h3 className="text-base font-semibold text-slate-900">{companyName}</h3>
        <p className="text-sm text-slate-600">{location}</p>
        <p className="text-xs text-slate-500">{metaParts.join(" · ")}</p>
        {shortDescription !== "" ? (
          <p className="line-clamp-1 text-sm text-slate-600">{shortDescription}</p>
        ) : null}
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
