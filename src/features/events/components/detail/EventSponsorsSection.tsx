"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buildSignupEntryUrl } from "@/src/lib/auth/buildAuthEntryUrl";
import type { SponsorNoteType } from "@/src/features/events/lib/sponsorNoteType";
import { secondaryCtaClass } from "@/src/lib/design/classes";
import type {
  PublicSponsorTierPageResult,
  PublicSponsorTierSummary,
} from "@/src/features/events/server/publicSponsorRoster";

import { EditionSponsorNote } from "./EditionSponsorNote";
import { EditionSectionSurface } from "./EditionSectionSurface";
import { PublicSponsorTierGroupedRoster } from "./PublicSponsorTierGroupedRoster";

type EventSponsorsSectionProps = {
  tierSummaries: PublicSponsorTierSummary;
  initialTier1Page: PublicSponsorTierPageResult;
  isAuthenticated: boolean;
  totalSponsorCount?: number;
  embedded?: boolean;
  sponsorNoteType?: SponsorNoteType | null;
};

export function EventSponsorsSection({
  tierSummaries,
  initialTier1Page,
  isAuthenticated,
  totalSponsorCount,
  embedded = false,
  sponsorNoteType = null,
}: EventSponsorsSectionProps) {
  const pathname = usePathname();
  const signupHref = buildSignupEntryUrl(pathname);
  const sponsors = initialTier1Page.rows;
  const effectiveTotalSponsorCount =
    totalSponsorCount ?? tierSummaries.totalSponsorCount;
  const showSponsorNote =
    effectiveTotalSponsorCount === 0 &&
    sponsorNoteType !== null &&
    sponsorNoteType !== undefined;

  return (
    <EditionSectionSurface embedded={embedded}>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Sponsors
        {effectiveTotalSponsorCount > 0
          ? ` (${effectiveTotalSponsorCount})`
          : ""}
      </h2>

      {showSponsorNote ? (
        <EditionSponsorNote sponsorNoteType={sponsorNoteType} />
      ) : (
        <PublicSponsorTierGroupedRoster
          sponsors={sponsors}
          tierSummaries={tierSummaries.tiers}
        />
      )}

      {!isAuthenticated ? (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="text-sm text-slate-600">
            Showing top-tier sponsors. Sign up to see the full list.
          </p>
          <Link
            href={signupHref}
            className={`${secondaryCtaClass} mt-3 inline-flex h-10 w-full`}
          >
            Sign up
          </Link>
        </div>
      ) : null}
    </EditionSectionSurface>
  );
}
