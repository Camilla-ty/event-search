import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import type { EventSponsorRow } from "./types";

function publicTierLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

export function EventSponsorListItem({ sponsor }: { sponsor: EventSponsorRow }) {
  const company = sponsor.companies;
  const tierLabel = publicTierLabel(sponsor.tier_label);
  const heading = company?.name?.trim() || "Unknown sponsor";
  const shortRaw = company?.short_description?.trim();
  const profileHref = company
    ? buildSponsorProfilePath({ slug: company.slug, id: company.id })
    : null;

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
            company={{
              name: company?.name,
              logo_url: company?.logo_url,
              domain: company?.domain,
              logo_status: company?.logo_status,
            }}
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white"
            monogramClassName="text-lg font-semibold text-slate-400"
            logoDevSize={112}
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
