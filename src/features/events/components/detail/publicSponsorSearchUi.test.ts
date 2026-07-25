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

  it("reuses PublicSponsorRosterRow for search results with exact tier_label badges", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/PublicSponsorSearchResults.tsx",
      ),
      "utf8",
    );
    const rowSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/PublicSponsorRosterRow.tsx",
      ),
      "utf8",
    );
    const hookSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/usePublicSponsorSearch.ts",
      ),
      "utf8",
    );
    assert.match(source, /PublicSponsorRosterRow/);
    assert.match(source, /showTierLabel/);
    assert.match(source, /tier_label: item\.tier_label/);
    assert.match(rowSource, /showTierLabel/);
    assert.match(rowSource, /tierLabel/);
    assert.match(hookSource, /tier_label/);
    assert.doesNotMatch(source, /Load more/);
    assert.doesNotMatch(rowSource, /Gold Partner|normalizeTier|tierRankToLabel/);
  });
});
