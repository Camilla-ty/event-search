import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicSponsorSearchResults } from "@/src/features/events/components/detail/PublicSponsorSearchResults";
import type { PublicSponsorSearchItem } from "@/src/features/events/server/publicSponsorSearch";

function item(partial: {
  id: string;
  name: string;
  tier_rank: number | null;
  tier_label: string | null;
  display_order?: number;
}): PublicSponsorSearchItem {
  return {
    id: partial.id,
    company_id: `co-${partial.id}`,
    tier_rank: partial.tier_rank,
    tier_label: partial.tier_label,
    display_order: partial.display_order ?? 1,
    company: {
      id: `co-${partial.id}`,
      name: partial.name,
      restricted: false,
      restricted_label: null,
      slug: partial.name.toLowerCase().replace(/\s+/g, "-"),
      domain: `${partial.id}.example`,
      website: null,
      logo_url: null,
      logo_source: null,
      logo_status: null,
      href: `/sponsors/${partial.name.toLowerCase().replace(/\s+/g, "-")}`,
    },
  };
}

describe("PublicSponsorSearchResults v2 grouping", () => {
  it("renders always-expanded tier panels ordered by tier_rank with match counts", () => {
    const html = renderToStaticMarkup(
      <PublicSponsorSearchResults
        query="bank"
        loading={false}
        error={null}
        fetched
        items={[
          item({
            id: "a",
            name: "Bank Of London",
            tier_rank: 1,
            tier_label: "Platinum Sponsor",
            display_order: 1,
          }),
          item({
            id: "c",
            name: "ClearBank",
            tier_rank: 3,
            tier_label: "Silver Sponsor",
            display_order: 1,
          }),
          item({
            id: "b",
            name: "One Zero Bank",
            tier_rank: 2,
            tier_label: "Gold Sponsor",
            display_order: 1,
          }),
        ]}
      />,
    );

    assert.match(html, /Platinum Sponsor · 1 sponsor/);
    assert.match(html, /Gold Sponsor · 1 sponsor/);
    assert.match(html, /Silver Sponsor · 1 sponsor/);
    assert.match(html, /Bank Of London/);
    assert.match(html, /One Zero Bank/);
    assert.match(html, /ClearBank/);
    assert.match(html, /id="search-sponsor-tier-header-1"/);
    assert.match(html, /id="search-sponsor-tier-panel-2"/);
    assert.doesNotMatch(html, /aria-expanded/);
    assert.doesNotMatch(html, /Load More/);

    const platinumAt = html.indexOf("Platinum Sponsor");
    const goldAt = html.indexOf("Gold Sponsor");
    const silverAt = html.indexOf("Silver Sponsor");
    assert.ok(platinumAt >= 0 && goldAt > platinumAt && silverAt > goldAt);
  });
});
