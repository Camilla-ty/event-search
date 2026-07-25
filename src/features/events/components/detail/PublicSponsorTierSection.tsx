import Link from "next/link";
import { ChevronDown, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

import { secondaryCtaClass } from "@/src/lib/design/classes";

import { PublicSponsorRosterRow } from "./PublicSponsorRosterRow";
import { PublicSponsorTierPanel } from "./PublicSponsorTierPanel";
import type { EventSponsorRow } from "./types";

type PublicSponsorTierSectionProps = {
  tierRank: number | null;
  tierLabel: string | null;
  totalCount: number;
  expanded: boolean;
  locked: boolean;
  sponsors: EventSponsorRow[];
  /** Lazy-load state for Tier 2+ (null when not applicable / not started). */
  loadStatus?: "loading" | "loading-more" | "idle" | "error" | null;
  errorMessage?: string | null;
  hasMore?: boolean;
  panelId: string;
  headerId: string;
  loginHref: string;
  signupHref: string;
  onToggle: () => void;
  onRetry?: () => void;
  onLoadMore?: () => void;
};

export function PublicSponsorTierSection({
  tierRank,
  tierLabel,
  totalCount,
  expanded,
  locked,
  sponsors,
  loadStatus = null,
  errorMessage = null,
  hasMore = false,
  panelId,
  headerId,
  loginHref,
  signupHref,
  onToggle,
  onRetry,
  onLoadMore,
}: PublicSponsorTierSectionProps) {
  const isInitialTier = tierRank === 1;

  let body: ReactNode;
  if (locked) {
    body = (
      <div className="space-y-3 bg-slate-50/60 px-4 py-5">
        <p className="text-sm text-slate-600">
          Log in or sign up to view sponsors in this tier.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={loginHref}
            prefetch={false}
            className={`${secondaryCtaClass} h-10 px-4`}
          >
            Log in
          </Link>
          <Link
            href={signupHref}
            prefetch={false}
            className={`${secondaryCtaClass} h-10 px-4`}
          >
            Sign up
          </Link>
        </div>
      </div>
    );
  } else if (loadStatus === "loading") {
    body = (
      <p aria-live="polite" className="px-4 py-5 text-sm text-slate-500">
        Loading sponsors…
      </p>
    );
  } else if (loadStatus === "error" && sponsors.length === 0) {
    body = (
      <div className="space-y-3 px-4 py-5" aria-live="polite">
        <p className="text-sm text-slate-600">
          {errorMessage ?? "Couldn't load sponsors for this tier."}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={`${secondaryCtaClass} h-10 px-4`}
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  } else if (
    isInitialTier ||
    loadStatus === "idle" ||
    loadStatus === "loading-more" ||
    (loadStatus === "error" && sponsors.length > 0)
  ) {
    if (sponsors.length > 0) {
      body = (
        <>
          <ul>
            {sponsors.map((sponsor) => (
              <PublicSponsorRosterRow
                key={String(sponsor.id)}
                sponsor={sponsor}
              />
            ))}
          </ul>
          {loadStatus === "error" ? (
            <div
              className="space-y-3 border-t border-slate-200 px-4 py-4"
              aria-live="polite"
            >
              <p className="text-sm text-slate-600">
                {errorMessage ?? "Couldn't load more sponsors."}
              </p>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className={`${secondaryCtaClass} h-10 px-4`}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : hasMore && onLoadMore ? (
            <div className="border-t border-slate-200 px-4 py-4">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadStatus === "loading-more"}
                aria-busy={loadStatus === "loading-more"}
                className={`${secondaryCtaClass} h-10 w-full px-4 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {loadStatus === "loading-more" ? "Loading more…" : "Load More"}
              </button>
            </div>
          ) : null}
        </>
      );
    } else {
      body = (
        <p className="px-4 py-5 text-sm text-slate-500">
          No sponsors linked to this tier yet.
        </p>
      );
    }
  } else {
    body = (
      <p className="px-4 py-5 text-sm text-slate-500">
        Sponsor details are not loaded yet.
      </p>
    );
  }

  return (
    <PublicSponsorTierPanel
      tierLabel={tierLabel}
      count={totalCount}
      headerId={headerId}
      panelId={panelId}
      showBody={expanded}
      interactive={{
        expanded,
        onToggle,
        trailing: (
          <>
            {locked ? (
              <>
                <span className="sr-only">Login required.</span>
                <LockKeyhole aria-hidden="true" className="h-4 w-4" />
              </>
            ) : null}
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </>
        ),
      }}
    >
      {body}
    </PublicSponsorTierPanel>
  );
}
