import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVENT_LIFECYCLE_STATUS_OPTIONS,
  formatEventLifecycleStatusLabel,
  isEventLifecycleStatus,
  parseOptionalLifecycleStatus,
} from "@/src/lib/validation/eventLifecycleStatus";

describe("eventLifecycleStatus", () => {
  it("accepts known lifecycle statuses", () => {
    assert.equal(isEventLifecycleStatus("active"), true);
    assert.equal(isEventLifecycleStatus("merged"), true);
    assert.equal(isEventLifecycleStatus("unknown"), false);
  });

  it("does not treat rebranded as a valid lifecycle status", () => {
    assert.equal(isEventLifecycleStatus("rebranded"), false);
  });

  it("parses blank lifecycle status as null", () => {
    assert.equal(parseOptionalLifecycleStatus(""), null);
    assert.equal(parseOptionalLifecycleStatus(null), null);
  });

  it("formats lifecycle labels", () => {
    assert.equal(formatEventLifecycleStatusLabel("merged"), "Merged");
    assert.equal(formatEventLifecycleStatusLabel(null), null);
  });

  it("does not offer rebranded as an admin option", () => {
    assert.equal(
      EVENT_LIFECYCLE_STATUS_OPTIONS.some((option) => option.value === "rebranded"),
      false,
    );
  });
});
