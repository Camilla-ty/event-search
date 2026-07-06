import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePublicEditionTab } from "@/src/features/events/components/detail/PublicEventEditionTabs";

describe("parsePublicEditionTab", () => {
  it("falls back to overview when partner-alumni tab is hidden", () => {
    assert.equal(parsePublicEditionTab("partner-alumni", false), "overview");
  });

  it("selects partner-alumni when tab is shown", () => {
    assert.equal(parsePublicEditionTab("partner-alumni", true), "partner-alumni");
  });

  it("preserves other tab ids", () => {
    assert.equal(parsePublicEditionTab("sponsors", false), "sponsors");
    assert.equal(parsePublicEditionTab("venue", true), "venue");
    assert.equal(parsePublicEditionTab("organizers", true), "organizers");
    assert.equal(parsePublicEditionTab(null, true), "overview");
  });
});
