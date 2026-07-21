import { useMemo, useState } from "react";

import { groupSponsorsByTier } from "@/src/features/events/lib/groupSponsorsByTier";
import type {
  PublicSponsorTierPageResult,
  PublicSponsorTierSummaryItem,
} from "@/src/features/events/server/publicSponsorRoster";

import { PublicSponsorTierSection } from "./PublicSponsorTierSection";
import { usePublicSponsorTierLoader } from "./usePublicSponsorTierLoader";

type PublicSponsorTierGroupedRosterProps = {
  editionId: string;
  initialTier1Page: PublicSponsorTierPageResult;
  tierSummaries?: PublicSponsorTierSummaryItem[];
  isAuthenticated: boolean;
  loginHref: string;
  signupHref: string;
};

function tierKey(tierRank: number | null): string {
  return tierRank === null ? "unranked" : String(tierRank);
}

export function PublicSponsorTierGroupedRoster({
  editionId,
  initialTier1Page,
  tierSummaries = [],
  isAuthenticated,
  loginHref,
  signupHref,
}: PublicSponsorTierGroupedRosterProps) {
  const sponsors = initialTier1Page.rows;
  const tierGroups = useMemo(() => groupSponsorsByTier(sponsors), [sponsors]);
  const summaries = useMemo(
    () =>
      tierSummaries.length > 0
        ? tierSummaries
        : tierGroups.map((group) => ({
            tierRank: group.tierRank,
            tierLabel: group.tierLabel,
            count: group.sponsors.length,
            locked: !isAuthenticated && group.tierRank !== 1,
          })),
    [isAuthenticated, tierGroups, tierSummaries],
  );
  const [openTierKey, setOpenTierKey] = useState<string | null>(() =>
    summaries.some((summary) => summary.tierRank === 1) ? tierKey(1) : null,
  );
  const {
    openTier,
    loadTier,
    loadMore,
    retry,
    reset,
    restoreInitialTier,
  } = usePublicSponsorTierLoader(editionId, initialTier1Page);

  if (summaries.length === 0) {
    return (
      <p className="text-sm text-slate-500">No sponsors linked to this event yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((summary) => {
        const rank = summary.tierRank;
        const key = tierKey(rank);
        const expanded = openTierKey === key;
        const locked = summary.locked || (!isAuthenticated && rank !== 1);
        const slug = rank === null ? "unranked" : String(rank);
        const lazyLoadable = !locked && rank !== null;
        const loadState =
          lazyLoadable && openTier !== null && openTier.tierRank === rank
            ? openTier
            : null;

        return (
          <PublicSponsorTierSection
            key={key}
            tierRank={rank}
            tierLabel={summary.tierLabel}
            totalCount={summary.count}
            expanded={expanded}
            locked={locked}
            sponsors={loadState?.rows ?? []}
            loadStatus={loadState?.status ?? null}
            errorMessage={loadState?.errorMessage ?? null}
            hasMore={isAuthenticated && (loadState?.hasMore ?? false)}
            panelId={`public-sponsor-tier-panel-${slug}`}
            headerId={`public-sponsor-tier-header-${slug}`}
            loginHref={loginHref}
            signupHref={signupHref}
            onToggle={() => {
              if (openTierKey === key) {
                // Collapse: abort any in-flight request and discard rows.
                reset();
                setOpenTierKey(null);
                return;
              }
              if (!locked && rank !== null && (isAuthenticated || rank !== 1)) {
                loadTier(rank);
              } else if (rank === 1) {
                // Anonymous viewers reuse the SSR Tier 1 page and never call the API.
                restoreInitialTier();
              } else {
                // Locked / unranked: never fetch, drop previous tier rows.
                reset();
              }
              setOpenTierKey(key);
            }}
            onRetry={
              !locked && rank !== null ? retry : undefined
            }
            onLoadMore={isAuthenticated && lazyLoadable ? loadMore : undefined}
          />
        );
      })}
    </div>
  );
}
