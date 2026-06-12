import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SponsorImportRow } from "./client/types";
import { isEligibleForBulkCreateNew } from "./reviewQueueEligibility";

function baseRow(overrides: Partial<SponsorImportRow>): SponsorImportRow {
  return {
    id: "row-1",
    batch_id: "batch-1",
    excel_row_number: 2,
    raw_company_name: "Community Project",
    raw_website: null,
    raw_tier_rank: 1,
    raw_tier_label: null,
    normalized_company_name: "Community Project",
    normalized_website: null,
    normalized_domain: null,
    mapped_tier_rank: 1,
    mapped_tier_label: null,
    status: "needs_review",
    validation_issues: [],
    has_blocking_validation: false,
    match_method: null,
    match_confidence: null,
    proposed_company_id: null,
    conflict_type: null,
    decision_type: null,
    resolved_company_id: null,
    duplicate_cluster_key: null,
    duplicate_role: null,
    duplicate_of_row_id: null,
    duplicate_resolution: null,
    already_on_live_sponsor_id: null,
    already_on_live_tier_rank: null,
    intended_link_action: "create_new_link",
    ...overrides,
  };
}

describe("isEligibleForBulkCreateNew", () => {
  it("allows create_new when website is blank but company name is present", () => {
    assert.equal(isEligibleForBulkCreateNew(baseRow({})), true);
  });
});
