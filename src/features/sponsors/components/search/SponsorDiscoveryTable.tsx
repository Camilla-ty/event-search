"use client";

import { type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/src/components/common";
import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { formatPublicCompanyWebsite } from "@/src/lib/domain/formatPublicCompanyWebsite";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import type { SponsorDiscoveryRow } from "./discoveryTypes";

function publicTierLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

function SponsoredEditionCount({ count }: { count: number }) {
  const value = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  const noun = value === 1 ? "event" : "events";

  return (
    <span>
      <span className="font-semibold text-slate-800">{value.toLocaleString()}</span>
      <span className="text-slate-500"> {noun}</span>
    </span>
  );
}

type SponsorDiscoveryTableRowProps = {
  row: SponsorDiscoveryRow;
  showEventTier: boolean;
};

function SponsorDiscoveryTableRow({ row, showEventTier }: SponsorDiscoveryTableRowProps) {
  const router = useRouter();
  const companyName = row.name.trim() !== "" ? row.name.trim() : "Unknown Sponsor";
  const profileHref = buildSponsorProfilePath({ slug: row.slug, id: row.id });
  const websiteDisplay = formatPublicCompanyWebsite({
    website: row.website,
    domain: row.domain,
  });
  const tierLabel =
    showEventTier && row.event_tier !== null
      ? publicTierLabel(row.event_tier.tier_label)
      : null;

  function navigateToProfile() {
    if (profileHref) {
      router.push(profileHref);
    }
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (!profileHref) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(profileHref);
    }
  }

  return (
    <tr
      onClick={navigateToProfile}
      onKeyDown={handleRowKeyDown}
      tabIndex={profileHref ? 0 : undefined}
      role={profileHref ? "link" : undefined}
      aria-label={profileHref ? `View ${companyName}` : undefined}
      className={[
        "border-b border-slate-100 last:border-0",
        "hover:bg-brand-primary-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/25 focus-visible:ring-inset",
        profileHref ? "cursor-pointer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <td className="px-4 py-3 align-middle">
        <CompanyLogo
          company={companyLogoFieldsFromRow(row)}
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50"
          monogramClassName="text-sm font-semibold text-slate-400"
        />
      </td>
      <td className="px-4 py-3 align-middle text-base font-semibold text-slate-900">
        {companyName}
      </td>
      <td className="max-w-xs px-4 py-3 align-middle text-sm text-slate-500">
        {websiteDisplay ? (
          <span className="block truncate">{websiteDisplay.label}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-middle text-sm">
        <SponsoredEditionCount count={row.sponsored_edition_count} />
      </td>
      {showEventTier ? (
        <td className="whitespace-nowrap px-4 py-3 align-middle">
          {tierLabel ? <Badge variant="success">{tierLabel}</Badge> : "—"}
        </td>
      ) : null}
    </tr>
  );
}

type SponsorDiscoveryTableProps = {
  rows: SponsorDiscoveryRow[];
  showEventTier?: boolean;
};

export function SponsorDiscoveryTable({
  rows,
  showEventTier = false,
}: SponsorDiscoveryTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="w-16 px-4 py-3 font-medium">Logo</th>
            <th className="px-4 py-3 font-medium">Sponsor</th>
            <th className="px-4 py-3 font-medium">Website</th>
            <th className="whitespace-nowrap px-4 py-3 font-medium">Events sponsored</th>
            {showEventTier ? (
              <th className="whitespace-nowrap px-4 py-3 font-medium">Tier</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SponsorDiscoveryTableRow
              key={row.id}
              row={row}
              showEventTier={showEventTier}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
