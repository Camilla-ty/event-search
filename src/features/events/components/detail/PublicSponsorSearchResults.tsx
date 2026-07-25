import type { PublicSponsorSearchItem } from "@/src/features/events/server/publicSponsorSearch";

import { PublicSponsorRosterRow } from "./PublicSponsorRosterRow";
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
    },
  };
}

type PublicSponsorSearchResultsProps = {
  items: PublicSponsorSearchItem[];
  loading: boolean;
  error: string | null;
  fetched: boolean;
  query: string;
};

export function PublicSponsorSearchResults({
  items,
  loading,
  error,
  fetched,
  query,
}: PublicSponsorSearchResultsProps) {
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

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Showing up to {items.length} match{items.length === 1 ? "" : "es"}
        {loading ? "…" : ""}
      </p>
      <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {items.map((item) => (
          <PublicSponsorRosterRow
            key={item.id}
            sponsor={searchItemToSponsorRow(item)}
            showTierLabel
          />
        ))}
      </ul>
    </div>
  );
}
