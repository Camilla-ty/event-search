"use client";

import Link from "next/link";

import { Badge } from "@/src/components/common";
import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import type { SponsorDiscoveryRow } from "./discoveryTypes";

const cardSurfaceClass =
  "grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[auto_1fr] md:items-center";

const cardInteractiveClass = [
  cardSurfaceClass,
  "cursor-pointer transition",
  "hover:border-brand-primary/40 hover:bg-brand-primary-muted/30",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2",
].join(" ");

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

type SponsorDiscoveryCardContentProps = {
  row: SponsorDiscoveryRow;
  companyName: string;
  location: string;
  metaParts: string[];
  shortDescription: string;
  tierLabel: string | null;
};

function SponsorDiscoveryCardContent({
  row,
  companyName,
  location,
  metaParts,
  shortDescription,
  tierLabel,
}: SponsorDiscoveryCardContentProps) {
  return (
    <>
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
    </>
  );
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
  const locationLabel = row.location_label?.trim() ?? "";
  const location = locationLabel !== "" ? locationLabel : "Location not set";
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

  const contentProps: SponsorDiscoveryCardContentProps = {
    row,
    companyName,
    location,
    metaParts,
    shortDescription,
    tierLabel,
  };

  if (!profileHref) {
    return (
      <article className={cardSurfaceClass}>
        <SponsorDiscoveryCardContent {...contentProps} />
      </article>
    );
  }

  return (
    <Link href={profileHref} className={cardInteractiveClass}>
      <SponsorDiscoveryCardContent {...contentProps} />
    </Link>
  );
}
