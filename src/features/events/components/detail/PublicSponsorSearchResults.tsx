import { groupSponsorsByTier } from "@/src/features/events/lib/groupSponsorsByTier";
import type { PublicSponsorSearchItem } from "@/src/features/events/server/publicSponsorSearch";

import { PublicSponsorTierPanel } from "./PublicSponsorTierPanel";
import type { EventSponsorRow } from "./types";

function searchItemToSponsorRow(item: PublicSponsorSearchItem): EventSponsorRow {
  return {
    id: item.id,
    company_id: item.company_id,
    tier_rank: item.tier_rank,
    tier_label: item.tier_label,
    display_order: item.display_order,
    companies: {
      id: item.company.id,
      name: item.company.name,
      slug: item.company.slug,
      domain: item.company.domain,
      website: item.company.website,
      logo_url: item.company.logo_url,
      logo_source: item.company.logo_source,
      logo_status: item.company.logo_status,
      // Sentinel for isCompanyRestricted — API already scrubbed sensitive fields.
      restricted_at: item.company.restricted ? "restricted" : null,
      public_href: item.company.href,
    },
  };
}

function searchTierSlug(tierRank: number | null): string {
  return tierRank === null ? "unranked" : String(tierRank);
}

type PublicSponsorSearchResultsProps = {
  items: PublicSponsorSearchItem[];
  loading: boolean;
  error: string | null;
  fetched: boolean;
  query: string;
};

/**
 * Search results as a filtered sponsor roster: always-expanded tier panels,
 * no accordion / Load more / lazy load. Groups the capped flat API response.
 */
export function PublicSponsorSearchResults({
  items,
  loading,
  error,
  fetched,
  query,
}: PublicSponsorSearchResultsProps) {
  const rows = items.map(searchItemToSponsorRow);
  const tierGroups = groupSponsorsByTier(rows);

  if (loading && items.length === 0) {
    return (
      <p className="text-sm text-slate-500" role="status">
        Searching sponsors…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-rose-700" role="alert">
        {error}
      </p>
    );
  }

  if (fetched && items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No sponsors match “{query}”.
      </p>
    );
  }

  if (tierGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Showing up to {items.length} match{items.length === 1 ? "" : "es"}
        {loading ? "…" : ""}
      </p>
      {tierGroups.map((group) => {
        const slug = searchTierSlug(group.tierRank);
        return (
          <PublicSponsorTierPanel
            key={slug}
            tierLabel={group.tierLabel}
            count={group.sponsors.length}
            headerId={`search-sponsor-tier-header-${slug}`}
            panelId={`search-sponsor-tier-panel-${slug}`}
            sponsors={group.sponsors}
          />
        );
      })}
    </div>
  );
}
