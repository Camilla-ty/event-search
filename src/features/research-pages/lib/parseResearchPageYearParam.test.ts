import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseResearchPageYearParam } from "@/src/features/research-pages/lib/parseResearchPageYearParam";

describe("parseResearchPageYearParam", () => {
  it("accepts a valid year", () => {
    assert.equal(parseResearchPageYearParam("2026"), 2026);
  });

  it("rejects leading zeros, non-integers, and out-of-range values", () => {
    assert.equal(parseResearchPageYearParam("02026"), null);
    assert.equal(parseResearchPageYearParam("abc"), null);
    assert.equal(parseResearchPageYearParam("2026.5"), null);
    assert.equal(parseResearchPageYearParam("1899"), null);
    assert.equal(parseResearchPageYearParam("2101"), null);
  });
});
