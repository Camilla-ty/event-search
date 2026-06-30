import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatEventLifecycleStatusLabel,
  isEventLifecycleStatus,
  parseOptionalLifecycleStatus,
} from "@/src/lib/validation/eventLifecycleStatus";

describe("eventLifecycleStatus", () => {
  it("accepts known lifecycle statuses", () => {
    assert.equal(isEventLifecycleStatus("active"), true);
    assert.equal(isEventLifecycleStatus("unknown"), false);
  });

  it("parses blank lifecycle status as null", () => {
    assert.equal(parseOptionalLifecycleStatus(""), null);
    assert.equal(parseOptionalLifecycleStatus(null), null);
  });

  it("formats lifecycle labels", () => {
    assert.equal(formatEventLifecycleStatusLabel("rebranded"), "Rebranded");
    assert.equal(formatEventLifecycleStatusLabel(null), null);
  });
});
