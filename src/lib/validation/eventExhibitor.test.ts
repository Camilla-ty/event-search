import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateEventExhibitorCreateBody,
  validateEventExhibitorReorderBody,
  validateEventExhibitorUpdateBody,
} from "@/src/lib/validation/eventExhibitor";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const LINK_A = "22222222-2222-4222-8222-222222222222";
const LINK_B = "33333333-3333-4333-8333-333333333333";

describe("validateEventExhibitorCreateBody", () => {
  it("accepts a valid create payload", () => {
    const result = validateEventExhibitorCreateBody({
      company_id: COMPANY_ID,
      tier_rank: 1,
      tier_label: "Platinum",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.company_id, COMPANY_ID);
      assert.equal(result.data.tier_rank, 1);
      assert.equal(result.data.tier_label, "Platinum");
    }
  });

  it("allows blank tier_label as null", () => {
    const result = validateEventExhibitorCreateBody({
      company_id: COMPANY_ID,
      tier_rank: 2,
      tier_label: "  ",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.tier_label, null);
    }
  });

  it("rejects invalid company_id and out-of-range rank", () => {
    const result = validateEventExhibitorCreateBody({
      company_id: "not-a-uuid",
      tier_rank: 0,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.join("; "), /company_id must be a valid UUID/);
      assert.match(result.errors.join("; "), /tier_rank must be between/);
    }
  });
});

describe("validateEventExhibitorUpdateBody", () => {
  it("accepts tier_rank and clearable tier_label", () => {
    const result = validateEventExhibitorUpdateBody({
      tier_rank: 3,
      tier_label: null,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.patch.tier_rank, 3);
      assert.equal(result.patch.tier_label, null);
    }
  });

  it("rejects empty patch", () => {
    const result = validateEventExhibitorUpdateBody({});
    assert.equal(result.ok, false);
  });
});

describe("validateEventExhibitorReorderBody", () => {
  it("accepts a valid reorder payload", () => {
    const result = validateEventExhibitorReorderBody({
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
    const result = validateEventExhibitorReorderBody({
      tier_rank: null,
      ordered_link_ids: [LINK_A],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.tier_rank, null);
    }
  });

  it("rejects invalid UUIDs in ordered_link_ids", () => {
    const result = validateEventExhibitorReorderBody({
      tier_rank: 1,
      ordered_link_ids: ["not-a-uuid"],
    });
    assert.equal(result.ok, false);
  });
});
