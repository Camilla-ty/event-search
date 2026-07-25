import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { PUBLIC_SPONSOR_SEARCH_DEBOUNCE_MS } from "@/src/features/events/components/detail/usePublicSponsorSearch";
import { PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH } from "@/src/features/events/server/publicSponsorSearchParams";

describe("Sponsor Search S2 UI wiring", () => {
  it("shows search only for authenticated Sponsors tab viewers", () => {
    const withSearch = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/PublicSponsorRosterWithSearch.tsx",
      ),
      "utf8",
    );
    const section = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/EventSponsorsSection.tsx",
      ),
      "utf8",
    );

    assert.match(section, /PublicSponsorRosterWithSearch/);
    assert.match(withSearch, /isAuthenticated \? \(/);
    assert.match(withSearch, /edition-sponsor-search/);
    assert.match(withSearch, /usePublicSponsorSearch/);
    assert.match(withSearch, /searchMode \? "hidden"/);
    assert.doesNotMatch(withSearch, /searchParams|URLSearchParams|router\.push|\?q=/);
  });

  it("client hook debounces and rejects total/hasMore payloads", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/usePublicSponsorSearch.ts",
      ),
      "utf8",
    );

    assert.equal(PUBLIC_SPONSOR_SEARCH_DEBOUNCE_MS, 275);
    assert.equal(PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH, 3);
    assert.match(source, /PUBLIC_SPONSOR_SEARCH_DEBOUNCE_MS/);
    assert.match(source, /\/api\/events\/\$\{encodeURIComponent\(editionId\)\}\/sponsors\/search/);
    assert.match(source, /"total" in payload/);
    assert.match(source, /"hasMore" in payload/);
    assert.match(source, /Authentication required/);
    assert.doesNotMatch(source, /Load more|hasMore\s*:/);
  });

  it("wires v2 grouped results through shared tier panels without accordion controls", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/PublicSponsorSearchResults.tsx",
      ),
      "utf8",
    );
    assert.match(source, /groupSponsorsByTier/);
    assert.match(source, /PublicSponsorTierPanel/);
    assert.match(source, /search-sponsor-tier-header-/);
    assert.match(source, /search-sponsor-tier-panel-/);
    assert.match(source, /count=\{group\.sponsors\.length\}/);
    assert.doesNotMatch(source, /\bonToggle\b|\baria-expanded\b|\blocked\b|hasMore|onLoadMore/);
    assert.doesNotMatch(source, /tierSummaries|totalSponsorCount/);
    assert.doesNotMatch(source, /interactive=/);
  });

  it("keeps accordion restore wiring and shares tier panel chrome with the live roster", () => {
    const withSearch = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/PublicSponsorRosterWithSearch.tsx",
      ),
      "utf8",
    );
    const section = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/PublicSponsorTierSection.tsx",
      ),
      "utf8",
    );
    assert.match(withSearch, /searchMode \? "hidden"/);
    assert.match(withSearch, /PublicSponsorTierGroupedRoster/);
    assert.match(section, /PublicSponsorTierPanel/);
    assert.match(section, /interactive=\{\{/);
    assert.match(section, /Load More/);
  });
});
