import Link from "next/link";

import {
  relatedSponsorListLabel,
  sponsorDetailHref,
  sponsorRouteSegment,
} from "./eventSponsorUtils";
import type { EventSponsorRow } from "./types";

type EventSponsorListItemProps = {
  sponsor: EventSponsorRow;
};

export function EventSponsorListItem({ sponsor }: EventSponsorListItemProps) {
  const segment = sponsorRouteSegment(sponsor);
  if (!segment) {
    return null;
  }

  const company = sponsor.companies;
  const heading = relatedSponsorListLabel(sponsor);
  const href = sponsorDetailHref(segment);
  const logoRaw = company?.logo_url?.trim();
  const shortRaw = company?.short_description?.trim();

  return (
    <li>
      <Link
        href={href}
        className="block rounded-lg border border-slate-200 p-3 transition hover:border-violet-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-violet-700 dark:hover:bg-slate-800/80"
      >
        <div className="flex gap-3">
          {logoRaw ? (
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
              <img src={logoRaw} alt="" className="h-full w-full object-contain" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{heading}</p>
              {sponsor.tier_rank != null ? (
                <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Tier {sponsor.tier_rank}
                </span>
              ) : null}
            </div>
            {shortRaw ? (
              <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{shortRaw}</p>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
