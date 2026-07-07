import Link from "next/link";

import { brandLinkClass } from "@/src/lib/design/classes";

import { EventSponsorListItem } from "./EventSponsorListItem";
import { buildPublicEditionTabHref } from "./publicEditionTabUrls";
import type { EventSponsorRow } from "./types";

const SPONSOR_PREVIEW_LIMIT = 5;

type EventSponsorsOverviewSectionProps = {
  eventSlug: string;
  sponsors: EventSponsorRow[];
  totalSponsorCount: number;
};

export function EventSponsorsOverviewSection({
  eventSlug,
  sponsors,
  totalSponsorCount,
}: EventSponsorsOverviewSectionProps) {
  const hasSponsorData = totalSponsorCount > 0 || sponsors.length > 0;
  const previewSponsors = sponsors.slice(0, SPONSOR_PREVIEW_LIMIT);
  const sponsorsTabHref = buildPublicEditionTabHref(eventSlug, "sponsors");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Sponsors</h2>
        {hasSponsorData ? (
          <Link href={sponsorsTabHref} className={`text-sm ${brandLinkClass}`}>
            View all sponsors
          </Link>
        ) : null}
      </div>

      {hasSponsorData ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              {totalSponsorCount.toLocaleString()}
            </span>{" "}
            {totalSponsorCount === 1 ? "sponsor" : "sponsors"}
          </p>
          {previewSponsors.length > 0 ? (
            <ul className="space-y-2">
              {previewSponsors.map((sponsor) => (
                <EventSponsorListItem
                  key={String(sponsor.id)}
                  sponsor={sponsor}
                  variant="compact"
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sponsor data not yet available.</p>
      )}
    </section>
  );
}
