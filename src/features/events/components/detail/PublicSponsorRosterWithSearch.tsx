"use client";

import { useState } from "react";

import { PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH } from "@/src/features/events/server/publicSponsorSearchParams";
import type {
  PublicSponsorTierPageResult,
  PublicSponsorTierSummary,
} from "@/src/features/events/server/publicSponsorRoster";

import { PublicSponsorSearchResults } from "./PublicSponsorSearchResults";
import { PublicSponsorTierGroupedRoster } from "./PublicSponsorTierGroupedRoster";
import { usePublicSponsorSearch } from "./usePublicSponsorSearch";

type PublicSponsorRosterWithSearchProps = {
  editionId: string;
  initialTier1Page: PublicSponsorTierPageResult;
  tierSummaries: PublicSponsorTierSummary["tiers"];
  isAuthenticated: boolean;
  loginHref: string;
  signupHref: string;
};

export function PublicSponsorRosterWithSearch({
  editionId,
  initialTier1Page,
  tierSummaries,
  isAuthenticated,
  loginHref,
  signupHref,
}: PublicSponsorRosterWithSearchProps) {
  const [query, setQuery] = useState("");
  const search = usePublicSponsorSearch(editionId, query, {
    enabled: isAuthenticated,
  });
  const searchMode = isAuthenticated && search.eligible;

  return (
    <div className="space-y-4">
      {isAuthenticated ? (
        <div>
          <label htmlFor="edition-sponsor-search" className="sr-only">
            Search sponsors for this event
          </label>
          <input
            id="edition-sponsor-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search sponsors (min ${PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH} characters)`}
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
        </div>
      ) : null}

      {/* Keep roster mounted while searching so clear restores accordion state. */}
      <div className={searchMode ? "hidden" : undefined} aria-hidden={searchMode}>
        <PublicSponsorTierGroupedRoster
          key={editionId}
          editionId={editionId}
          initialTier1Page={initialTier1Page}
          tierSummaries={tierSummaries}
          isAuthenticated={isAuthenticated}
          loginHref={loginHref}
          signupHref={signupHref}
        />
      </div>

      {searchMode ? (
        <PublicSponsorSearchResults
          items={search.items}
          loading={search.loading}
          error={search.error}
          fetched={search.fetched}
          query={search.trimmedQuery}
        />
      ) : null}
    </div>
  );
}
