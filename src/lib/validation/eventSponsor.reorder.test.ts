import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateEventSponsorReorderBody } from "@/src/lib/validation/eventSponsor";

const LINK_A = "11111111-1111-4111-8111-111111111111";
const LINK_B = "22222222-2222-4222-8222-222222222222";

describe("validateEventSponsorReorderBody", () => {
  it("accepts a valid reorder payload", () => {
    const result = validateEventSponsorReorderBody({
      tier_rank: 2,
      ordered_link_ids: [LINK_A, LINK_B],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.tier_rank, 2);
      assert.deepEqual(result.data.ordered_link_ids, [LINK_A, LINK_B]);
    }
  });

  it("accepts null tier_rank for the unranked tier", () => {
    const result = validateEventSponsorReorderBody({
      tier_rank: null,
      ordered_link_ids: [LINK_A],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.tier_rank, null);
    }
  });

  it("requires tier_rank", () => {
    const result = validateEventSponsorReorderBody({
      ordered_link_ids: [LINK_A],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.join("; "), /tier_rank is required/);
    }
  });

  it("requires ordered_link_ids", () => {
    const result = validateEventSponsorReorderBody({
      tier_rank: 1,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.join("; "), /ordered_link_ids is required/);
    }
  });

  it("rejects invalid UUIDs in ordered_link_ids", () => {
    const result = validateEventSponsorReorderBody({
      tier_rank: 1,
      ordered_link_ids: ["not-a-uuid"],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.join("; "), /valid UUIDs/);
    }
  });

  it("rejects invalid tier_rank values", () => {
    const result = validateEventSponsorReorderBody({
      tier_rank: 0,
      ordered_link_ids: [LINK_A],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.join("; "), /tier_rank must be between/);
    }
  });
});
