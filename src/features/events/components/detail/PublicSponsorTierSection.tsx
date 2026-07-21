import Link from "next/link";
import { ChevronDown, LockKeyhole } from "lucide-react";

import { secondaryCtaClass } from "@/src/lib/design/classes";

import { PublicSponsorRosterRow } from "./PublicSponsorRosterRow";
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
  const label = tierLabel?.trim() || "Untitled tier";
  const sponsorWord = totalCount === 1 ? "sponsor" : "sponsors";
  const isInitialTier = tierRank === 1;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header>
        <button
          type="button"
          id={headerId}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left text-sm font-semibold tracking-tight text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/40"
        >
          <span>
            {label} · {totalCount} {sponsorWord}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-slate-500">
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
          </span>
        </button>
      </header>

      {expanded ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-slate-200"
        >
          {locked ? (
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
          ) : loadStatus === "loading" ? (
            <p
              aria-live="polite"
              className="px-4 py-5 text-sm text-slate-500"
            >
              Loading sponsors…
            </p>
          ) : loadStatus === "error" && sponsors.length === 0 ? (
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
          ) : isInitialTier ||
            loadStatus === "idle" ||
            loadStatus === "loading-more" ||
            (loadStatus === "error" && sponsors.length > 0) ? (
            sponsors.length > 0 ? (
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
                      {loadStatus === "loading-more"
                        ? "Loading more…"
                        : "Load More"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="px-4 py-5 text-sm text-slate-500">
                No sponsors linked to this tier yet.
              </p>
            )
          ) : (
            <p className="px-4 py-5 text-sm text-slate-500">
              Sponsor details are not loaded yet.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
