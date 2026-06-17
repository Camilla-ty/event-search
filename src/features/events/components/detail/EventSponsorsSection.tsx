"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buildSignupEntryUrl } from "@/src/lib/auth/buildAuthEntryUrl";
import { brandLinkClass, secondaryCtaClass } from "@/src/lib/design/classes";

import { EventSponsorListItem } from "./EventSponsorListItem";
import type { EventSponsorRow } from "./types";

type EventSponsorsSectionProps = {
  sponsors: EventSponsorRow[];
  isAuthenticated: boolean;
  eventSlug?: string;
};

export function EventSponsorsSection({
  sponsors,
  isAuthenticated,
  eventSlug = "",
}: EventSponsorsSectionProps) {
  const pathname = usePathname();
  const signupHref = buildSignupEntryUrl(pathname);
  const sponsorsExplorerHref =
    eventSlug.trim() !== ""
      ? `/sponsors?event=${encodeURIComponent(eventSlug.trim())}`
      : "/sponsors";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Related Sponsors</h2>
        <Link href={sponsorsExplorerHref} className={`text-sm ${brandLinkClass}`}>
          Explore sponsors
        </Link>
      </div>

      {sponsors.length === 0 ? (
        <p className="text-sm text-slate-500">No sponsors linked to this event yet.</p>
      ) : (
        <ul className="space-y-2">
          {sponsors.map((sponsor) => (
            <EventSponsorListItem key={String(sponsor.id)} sponsor={sponsor} />
          ))}
        </ul>
      )}

      {!isAuthenticated ? (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="text-sm text-slate-600">
            Use{" "}
            <Link href={sponsorsExplorerHref} className={brandLinkClass}>
              Explore sponsors
            </Link>{" "}
            in Actions to browse the full list for this event. Sign up to save lists and unlock
            account features.
          </p>
          <Link
            href={signupHref}
            className={`${secondaryCtaClass} mt-3 inline-flex h-10 w-full`}
          >
            Sign up
          </Link>
        </div>
      ) : null}
    </div>
  );
}