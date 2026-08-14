import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseSponsorNoteType,
  shouldShowPublicSponsorsTab,
  sponsorNoteDisplayMessage,
} from "@/src/features/events/lib/sponsorNoteType";

describe("parseSponsorNoteType", () => {
  it("accepts allowed values", () => {
    assert.equal(parseSponsorNoteType("upcoming_pending"), "upcoming_pending");
    assert.equal(parseSponsorNoteType("virtual_covid"), "virtual_covid");
  });

  it("normalizes empty values to null", () => {
    assert.equal(parseSponsorNoteType(null), null);
    assert.equal(parseSponsorNoteType(undefined), null);
    assert.equal(parseSponsorNoteType(""), null);
    assert.equal(parseSponsorNoteType("   "), null);
  });

  it("rejects unknown values", () => {
    assert.equal(parseSponsorNoteType("other"), null);
  });
});

describe("sponsorNoteDisplayMessage", () => {
  it("returns fixed copy for each type", () => {
    assert.match(
      sponsorNoteDisplayMessage("upcoming_pending"),
      /finalized after the event concludes/i,
    );
    assert.match(
      sponsorNoteDisplayMessage("virtual_covid"),
      /COVID-19 virtual event/i,
    );
  });
});

describe("shouldShowPublicSponsorsTab", () => {
  it("shows the tab when sponsors exist", () => {
    assert.equal(
      shouldShowPublicSponsorsTab({
        totalSponsorCount: 1,
        sponsorNoteType: null,
      }),
      true,
    );
  });

  it("hides the tab for a zero-sponsor upcoming_pending edition", () => {
    assert.equal(
      shouldShowPublicSponsorsTab({
        totalSponsorCount: 0,
        sponsorNoteType: "upcoming_pending",
      }),
      false,
    );
  });

  it("hides the tab for a zero-sponsor virtual_covid edition", () => {
    assert.equal(
      shouldShowPublicSponsorsTab({
        totalSponsorCount: 0,
        sponsorNoteType: "virtual_covid",
      }),
      false,
    );
  });

  it("shows the tab for a zero-sponsor edition without a note", () => {
    assert.equal(
      shouldShowPublicSponsorsTab({
        totalSponsorCount: 0,
        sponsorNoteType: null,
      }),
      true,
    );
  });
});
