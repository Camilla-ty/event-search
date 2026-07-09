"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buildSignupEntryUrl } from "@/src/lib/auth/buildAuthEntryUrl";
import type { SponsorNoteType } from "@/src/features/events/lib/sponsorNoteType";
import { secondaryCtaClass } from "@/src/lib/design/classes";

import { EditionSponsorNote } from "./EditionSponsorNote";
import { EditionSectionSurface } from "./EditionSectionSurface";
import { PublicSponsorTierGroupedRoster } from "./PublicSponsorTierGroupedRoster";
import type { EventSponsorRow } from "./types";

type EventSponsorsSectionProps = {
  sponsors: EventSponsorRow[];
  isAuthenticated: boolean;
  totalSponsorCount?: number;
  embedded?: boolean;
  sponsorNoteType?: SponsorNoteType | null;
};

export function EventSponsorsSection({
  sponsors,
  isAuthenticated,
  totalSponsorCount,
  embedded = false,
  sponsorNoteType = null,
}: EventSponsorsSectionProps) {
  const pathname = usePathname();
  const signupHref = buildSignupEntryUrl(pathname);
  const showSponsorNote =
    (totalSponsorCount ?? 0) === 0 && sponsorNoteType !== null && sponsorNoteType !== undefined;

  return (
    <EditionSectionSurface embedded={embedded}>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Sponsors{totalSponsorCount != null && totalSponsorCount > 0 ? ` (${totalSponsorCount})` : ""}
      </h2>

      {showSponsorNote ? (
        <EditionSponsorNote sponsorNoteType={sponsorNoteType} />
      ) : (
        <PublicSponsorTierGroupedRoster sponsors={sponsors} />
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
