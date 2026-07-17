import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bitcoinAsiaHubPassesGate,
  buildBitcoinAsiaHubMetaDescription,
  buildBitcoinAsiaHubSummary,
  buildBitcoinAsiaHubTitle,
  formatBitcoinAsiaHubLastReviewed,
  formatYearSpan,
  joinCountryNames,
} from "@/src/features/events/lib/bitcoinAsiaHub";

const FACTS = {
  topicName: "Bitcoin",
  regionName: "Asia",
  eventCount: 7,
  indexableEventCount: 3,
  seriesCount: 4,
  yearMin: 2025,
  yearMax: 2026,
  countryNames: ["China", "Singapore", "South Korea"],
  distinctSponsorCount: 769,
} as const;

describe("bitcoinAsiaHub copy helpers", () => {
  it("joins country names with Oxford and", () => {
    assert.equal(joinCountryNames(["China"]), "China");
    assert.equal(joinCountryNames(["China", "Singapore"]), "China and Singapore");
    assert.equal(
      joinCountryNames(["China", "Singapore", "South Korea"]),
      "China, Singapore, and South Korea",
    );
  });

  it("formats year spans", () => {
    assert.equal(formatYearSpan(2025, 2026), "2025–2026");
    assert.equal(formatYearSpan(2025, 2025), "2025");
  });

  it("builds the approved sponsor-first summary", () => {
    assert.equal(
      buildBitcoinAsiaHubSummary(FACTS),
      "769 sponsoring companies are recorded on Bitcoin events in Asia on EventPixels. They appear across 7 Bitcoin events (2025–2026) spanning 4 event brands in China, Singapore, and South Korea. 3 events have public sponsor rosters. Counts reflect EventPixels-recorded sponsorship data.",
    );
  });

  it("builds the approved meta description", () => {
    assert.equal(
      buildBitcoinAsiaHubMetaDescription(FACTS),
      "EventPixels records 7 Bitcoin events in Asia (2025–2026) across China, Singapore, and South Korea, with 769 companies recorded as sponsors of those events.",
    );
  });

  it("builds title and formats last reviewed", () => {
    assert.equal(buildBitcoinAsiaHubTitle("Bitcoin", "Asia"), "Bitcoin Events in Asia");
    assert.equal(
      formatBitcoinAsiaHubLastReviewed("2026-07-08 11:49:51.845+00"),
      "8 July 2026",
    );
  });

  it("enforces the hub gate", () => {
    assert.equal(
      bitcoinAsiaHubPassesGate({ indexableEventCount: 3, distinctSponsorCount: 769 }),
      true,
    );
    assert.equal(
      bitcoinAsiaHubPassesGate({ indexableEventCount: 2, distinctSponsorCount: 769 }),
      false,
    );
    assert.equal(
      bitcoinAsiaHubPassesGate({ indexableEventCount: 3, distinctSponsorCount: 4 }),
      false,
    );
  });
});
