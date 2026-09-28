import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SponsorImportRow } from "./client/types";
import { isEligibleForBulkCreateNew, resolveRowDomain } from "./reviewQueueEligibility";

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

describe("resolveRowDomain", () => {
  it("shows platform-owner roots as company domains", () => {
    assert.equal(
      resolveRowDomain(
        baseRow({
          raw_company_name: "GitHub",
          normalized_company_name: "GitHub",
          normalized_domain: "github.com",
          normalized_website: "https://github.com/",
          raw_website: "https://github.com/",
        }),
      ),
      "github.com",
    );
    assert.equal(
      resolveRowDomain(
        baseRow({
          raw_company_name: "LinkedIn",
          normalized_company_name: "LinkedIn",
          normalized_domain: "linkedin.com",
          normalized_website: "https://www.linkedin.com/",
          raw_website: "https://www.linkedin.com/",
        }),
      ),
      "linkedin.com",
    );
    assert.equal(
      resolveRowDomain(
        baseRow({
          raw_company_name: "YouTube",
          normalized_company_name: "YouTube",
          normalized_domain: "youtube.com",
          normalized_website: "https://www.youtube.com/",
          raw_website: "https://www.youtube.com/",
        }),
      ),
      "youtube.com",
    );
  });

  it("derives platform-owner domains from website when normalized_domain is still null", () => {
    assert.equal(
      resolveRowDomain(
        baseRow({
          raw_company_name: "GitHub",
          normalized_company_name: "GitHub",
          normalized_domain: null,
          normalized_website: "https://github.com/",
          raw_website: "https://github.com/",
        }),
      ),
      "github.com",
    );
    assert.equal(
      resolveRowDomain(
        baseRow({
          raw_company_name: "LinkedIn",
          normalized_company_name: "LinkedIn",
          normalized_domain: null,
          normalized_website: "https://www.linkedin.com/",
          raw_website: "https://www.linkedin.com/",
        }),
      ),
      "linkedin.com",
    );
    assert.equal(
      resolveRowDomain(
        baseRow({
          raw_company_name: "YouTube",
          normalized_company_name: "YouTube",
          normalized_domain: null,
          normalized_website: "https://www.youtube.com/",
          raw_website: "https://www.youtube.com/",
        }),
      ),
      "youtube.com",
    );
  });

  it("does not treat profile URLs as the platform company's domain", () => {
    assert.equal(
      resolveRowDomain(
        baseRow({
          raw_company_name: "Acme",
          normalized_company_name: "Acme",
          normalized_domain: null,
          normalized_website: "https://github.com/acme",
          raw_website: "https://github.com/acme",
        }),
      ),
      "",
    );
    assert.equal(
      resolveRowDomain(
        baseRow({
          raw_company_name: "Acme",
          normalized_company_name: "Acme",
          normalized_domain: "linkedin.com/company/acme",
          normalized_website: "https://www.linkedin.com/company/acme/",
          raw_website: "https://www.linkedin.com/company/acme/",
        }),
      ),
      "linkedin.com/company/acme",
    );
    assert.equal(
      resolveRowDomain(
        baseRow({
          raw_company_name: "Acme",
          normalized_company_name: "Acme",
          normalized_domain: "youtube.com/@acme",
          normalized_website: "https://www.youtube.com/@acme",
          raw_website: "https://www.youtube.com/@acme",
        }),
      ),
      "youtube.com/@acme",
    );
  });
});
