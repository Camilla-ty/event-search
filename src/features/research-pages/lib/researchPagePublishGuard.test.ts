import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanPublishResearchPage,
  canPublishResearchPage,
} from "@/src/features/research-pages/lib/researchPagePublishGuard";

describe("canPublishResearchPage", () => {
  it("allows all-years pages (year = null) to publish", () => {
    assert.equal(canPublishResearchPage(null), true);
    assert.doesNotThrow(() => assertCanPublishResearchPage(null));
  });

  it("allows year-specific pages to publish", () => {
    assert.equal(canPublishResearchPage(2026), true);
    assert.doesNotThrow(() => assertCanPublishResearchPage(2026));
  });
});
