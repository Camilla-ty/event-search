import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTopicRegionHubMetaDescription,
  buildTopicRegionHubSummary,
  buildTopicRegionHubTitle,
  formatTopicRegionHubLastReviewed,
  formatYearSpan,
  joinCountryNames,
  topicRegionHubPassesGate,
} from "@/src/features/events/lib/topicRegionHub";

const FACTS = {
  topicName: "Crypto & Blockchain",
  locationName: "Asia",
  eventCount: 7,
  indexableEventCount: 3,
  seriesCount: 4,
  yearMin: 2025,
  yearMax: 2026,
  countryNames: ["China", "Singapore", "South Korea"],
  distinctSponsorCount: 769,
} as const;

describe("topicRegionHub copy helpers", () => {
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
      buildTopicRegionHubSummary(FACTS),
      "769 sponsoring companies are recorded on Crypto & Blockchain events in Asia on EventPixels. They appear across 7 Crypto & Blockchain events (2025–2026) spanning 4 event brands in China, Singapore, and South Korea. 3 events have public sponsor rosters. Counts reflect EventPixels-recorded sponsorship data.",
    );
  });

  it("builds the approved meta description", () => {
    assert.equal(
      buildTopicRegionHubMetaDescription(FACTS),
      "EventPixels records 7 Crypto & Blockchain events in Asia (2025–2026) across China, Singapore, and South Korea, with 769 companies recorded as sponsors of those events.",
    );
  });

  it("builds copy for any topic, not just one hardcoded hub", () => {
    assert.equal(
      buildTopicRegionHubTitle("FinTech", "Asia"),
      "FinTech Events in Asia",
    );
    assert.equal(
      buildTopicRegionHubTitle("HealthTech", "Europe", 2026),
      "HealthTech Events in Europe (2026)",
    );
    assert.match(
      buildTopicRegionHubMetaDescription({ ...FACTS, topicName: "AI" }),
      /^EventPixels records 7 AI events in Asia/,
    );
  });

  it("builds copy for a country location, not just regions", () => {
    assert.equal(
      buildTopicRegionHubTitle("Crypto & Blockchain", "Singapore", 2026),
      "Crypto & Blockchain Events in Singapore (2026)",
    );
    assert.match(
      buildTopicRegionHubMetaDescription({
        ...FACTS,
        locationName: "Singapore",
        countryNames: ["Singapore"],
      }),
      /^EventPixels records 7 Crypto & Blockchain events in Singapore \(2025–2026\) across Singapore,/,
    );
  });

  it("formats last reviewed", () => {
    assert.equal(
      formatTopicRegionHubLastReviewed("2026-07-08 11:49:51.845+00"),
      "8 July 2026",
    );
  });

  it("enforces the hub gate", () => {
    assert.equal(
      topicRegionHubPassesGate({ indexableEventCount: 3, distinctSponsorCount: 769 }),
      true,
    );
    assert.equal(
      topicRegionHubPassesGate({ indexableEventCount: 2, distinctSponsorCount: 769 }),
      false,
    );
    assert.equal(
      topicRegionHubPassesGate({ indexableEventCount: 3, distinctSponsorCount: 4 }),
      false,
    );
  });
});
