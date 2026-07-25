import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PublicSponsorTierPanel,
  publicSponsorTierPanelTitle,
} from "@/src/features/events/components/detail/PublicSponsorTierPanel";

describe("PublicSponsorTierPanel", () => {
  it("formats the exact tier label and count in the header title", () => {
    assert.equal(
      publicSponsorTierPanelTitle("Platinum Sponsor", 1),
      "Platinum Sponsor · 1 sponsor",
    );
    assert.equal(
      publicSponsorTierPanelTitle("Gold Sponsor", 2),
      "Gold Sponsor · 2 sponsors",
    );
    assert.equal(publicSponsorTierPanelTitle(null, 0), "Untitled tier · 0 sponsors");
    assert.equal(publicSponsorTierPanelTitle("   ", 3), "Untitled tier · 3 sponsors");
  });

  it("renders static chrome with roster rows and no accordion controls", () => {
    const html = renderToStaticMarkup(
      <PublicSponsorTierPanel
        tierLabel="Gold Sponsor"
        count={1}
        headerId="search-sponsor-tier-header-2"
        panelId="search-sponsor-tier-panel-2"
        sponsors={[
          {
            id: "link-1",
            company_id: "co-1",
            tier_rank: 2,
            tier_label: "Gold Sponsor",
            companies: {
              id: "co-1",
              name: "One Zero Bank",
              domain: "onezero.example",
              slug: "one-zero-bank",
              restricted_at: null,
            },
          },
        ]}
      />,
    );

    assert.match(html, /Gold Sponsor · 1 sponsor/);
    assert.match(html, /One Zero Bank/);
    assert.match(html, /id="search-sponsor-tier-header-2"/);
    assert.match(html, /id="search-sponsor-tier-panel-2"/);
    assert.match(html, /rounded-xl border border-slate-200/);
    assert.doesNotMatch(html, /aria-expanded/);
    assert.doesNotMatch(html, /<button\b/);
    assert.doesNotMatch(html, /Load More|Loading sponsors|Login required/);
  });

  it("renders an interactive header when accordion controls are provided", () => {
    const html = renderToStaticMarkup(
      <PublicSponsorTierPanel
        tierLabel="Silver Sponsor"
        count={5}
        headerId="public-sponsor-tier-header-3"
        panelId="public-sponsor-tier-panel-3"
        showBody={false}
        interactive={{
          expanded: false,
          onToggle: () => {},
          trailing: <span data-testid="chevron">v</span>,
        }}
      >
        <p>Hidden when collapsed</p>
      </PublicSponsorTierPanel>,
    );

    assert.match(html, /Silver Sponsor · 5 sponsors/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /<button\b/);
    assert.doesNotMatch(html, /Hidden when collapsed/);
  });
});
