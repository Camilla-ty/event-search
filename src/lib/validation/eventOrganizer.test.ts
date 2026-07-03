import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  shouldAutoTouchOrganizerUpdate,
  validateEventOrganizerCreateBody,
  validateEventOrganizerReorderBody,
  validateEventOrganizerUpdateBody,
} from "@/src/lib/validation/eventOrganizer";

describe("eventOrganizer validation", () => {
  it("defaults role_label to Organizer on create", () => {
    const result = validateEventOrganizerCreateBody({
      company_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.role_label, "Organizer");
    }
  });

  it("rejects empty role_label on update", () => {
    const result = validateEventOrganizerUpdateBody({ role_label: "   " });
    assert.equal(result.ok, false);
  });

  it("accepts reorder up/down payload", () => {
    const result = validateEventOrganizerReorderBody({
      organizer_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      direction: "down",
    });
    assert.equal(result.ok, true);
  });

  it("detects meaningful role_label changes for last reviewed", () => {
    assert.equal(shouldAutoTouchOrganizerUpdate("Organizer", "Co-organizer"), true);
    assert.equal(shouldAutoTouchOrganizerUpdate("Organizer", "Organizer"), false);
    assert.equal(shouldAutoTouchOrganizerUpdate(" Host ", "Host"), false);
  });
});
