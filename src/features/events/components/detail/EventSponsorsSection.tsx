"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { EmailOtpAuthModal } from "@/src/components/auth/EmailOtpAuthModal";
import { Button } from "@/src/components/common";

import { EventSponsorListItem } from "./EventSponsorListItem";
import type { EventSponsorRow } from "./types";

type EventSponsorsSectionProps = {
  sponsors: EventSponsorRow[];
  isAuthenticated: boolean;
};

export function EventSponsorsSection({
  sponsors,
  isAuthenticated,
}: EventSponsorsSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  function handleAuthSuccess() {
    router.refresh();
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Related Sponsors
          </h2>
          <Link
            href="/sponsors"
            className="text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            View all
          </Link>
        </div>

        {sponsors.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No sponsors linked to this event yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {sponsors.map((sponsor) => (
              <EventSponsorListItem key={String(sponsor.id)} sponsor={sponsor} />
            ))}
          </ul>
        )}

        {!isAuthenticated ? (
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Additional sponsor tiers are available after you sign up.
            </p>
            <Button type="button" className="mt-3 w-full sm:w-auto" onClick={() => setAuthModalOpen(true)}>
              View More Sponsors
            </Button>
          </div>
        ) : null}
      </div>

      <EmailOtpAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        redirectTo={pathname}
        title="Sign up"
        description="Create your account to view additional sponsor tiers for this event."
      />
    </>
  );
}
