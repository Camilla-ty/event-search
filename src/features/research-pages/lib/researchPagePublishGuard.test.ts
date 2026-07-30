import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanPublishResearchPage,
  canPublishResearchPage,
  YEAR_SCOPED_PUBLISH_BLOCKED_MESSAGE,
} from "@/src/features/research-pages/lib/researchPagePublishGuard";

describe("canPublishResearchPage", () => {
  it("allows all-years pages (year = null) to publish", () => {
    assert.equal(canPublishResearchPage(null), true);
    assert.doesNotThrow(() => assertCanPublishResearchPage(null));
  });

  it("blocks year-specific pages from publishing", () => {
    assert.equal(canPublishResearchPage(2026), false);
    assert.throws(
      () => assertCanPublishResearchPage(2026),
      (error: unknown) =>
        error instanceof Error &&
        error.message === YEAR_SCOPED_PUBLISH_BLOCKED_MESSAGE,
    );
  });
});
