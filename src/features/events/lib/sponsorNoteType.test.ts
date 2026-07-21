import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseSponsorNoteType,
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
