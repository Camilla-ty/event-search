import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BitcoinAsiaHubView } from "@/src/features/events/components/bitcoin-asia/BitcoinAsiaHubView";
import type { BitcoinAsiaHubPageData } from "@/src/features/events/server/bitcoinAsiaHubPublic";

function makeHubData(
  overrides: Partial<BitcoinAsiaHubPageData> = {},
): BitcoinAsiaHubPageData {
  return {
    path: "/events/bitcoin-asia",
    title: "Bitcoin Events in Asia",
    metaDescription: "Meta description",
    h1: "Bitcoin Events in Asia",
    summary: "Summary text.",
    lastReviewedAt: null,
    lastReviewedLabel: null,
    facts: {
      topicName: "Bitcoin",
      regionName: "Asia",
      eventCount: 1,
      indexableEventCount: 1,
      seriesCount: 1,
      yearMin: 2026,
      yearMax: 2026,
      countryNames: ["Singapore"],
      distinctSponsorCount: 10,
    },
    events: [
      {
        id: "event-1",
        slug: "bitcoin-asia-2026",
        name: "Bitcoin Asia 2026",
        year: 2026,
        startDate: "2026-03-01",
        endDate: "2026-03-02",
        dateLabel: "Mar 1 – Mar 2, 2026",
        locationLabel: "Singapore",
        countryName: "Singapore",
        seriesName: "Bitcoin Asia",
        seriesSlug: "bitcoin-asia",
        sponsorCount: 5,
        lastReviewedAt: null,
        lastReviewedLabel: null,
      },
    ],
    sponsors: [],
    totalSponsorCount: 0,
    topicHubPath: "/topics/bitcoin",
    ...overrides,
  };
}

describe("BitcoinAsiaHubView", () => {
  it("labels the linked brand as Event brand, not Series", () => {
    const html = renderToStaticMarkup(<BitcoinAsiaHubView data={makeHubData()} />);

    assert.match(html, /Event brand:/);
    assert.match(html, /Bitcoin Asia/);
    assert.doesNotMatch(html, /\bSeries:/);
  });
});
