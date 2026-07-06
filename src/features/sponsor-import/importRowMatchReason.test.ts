import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SponsorImportRow } from "./client/types";
import {
  getImportRowMatchedAlias,
  hasImportRowMatchReason,
  resolveImportRowMatchReason,
} from "./importRowMatchReason";

function baseRow(overrides: Partial<SponsorImportRow> = {}): SponsorImportRow {
  return {
    id: "row-1",
    batch_id: "batch-1",
    excel_row_number: 2,
    raw_company_name: null,
    raw_website: null,
    raw_tier_rank: null,
    raw_tier_label: null,
    normalized_company_name: null,
    normalized_website: null,
    normalized_domain: null,
    mapped_tier_rank: 1,
    mapped_tier_label: "Gold",
    status: "auto_ready",
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
    intended_link_action: null,
    ...overrides,
  };
}

describe("resolveImportRowMatchReason", () => {
  it("returns domain match with normalized domain", () => {
    assert.deepEqual(
      resolveImportRowMatchReason(
        baseRow({
          match_method: "domain",
          normalized_domain: "keelinfra.com",
        }),
      ),
      { kind: "domain", domain: "keelinfra.com" },
    );
  });

  it("returns website match with normalized website", () => {
    assert.deepEqual(
      resolveImportRowMatchReason(
        baseRow({
          match_method: "website",
          normalized_website: "https://beacons.ai/nftfy",
        }),
      ),
      { kind: "website", website: "https://beacons.ai/nftfy" },
    );
  });

  it("returns exact name match", () => {
    assert.deepEqual(
      resolveImportRowMatchReason(
        baseRow({
          match_method: "exact_name",
          raw_company_name: "Keel Infrastructure",
        }),
      ),
      { kind: "exact_name" },
    );
  });

  it("returns alias match with import company name", () => {
    assert.deepEqual(
      resolveImportRowMatchReason(
        baseRow({
          match_method: "alias",
          raw_company_name: "Bitfarms",
        }),
      ),
      { kind: "alias", alias: "Bitfarms" },
    );
  });

  it("returns domain/name mismatch warning context", () => {
    assert.deepEqual(
      resolveImportRowMatchReason(
        baseRow({
          status: "needs_review",
          conflict_type: "domain_name_mismatch",
          raw_company_name: "Wrong Co",
          normalized_domain: "keelinfra.com",
          proposed_company_id: "company-1",
        }),
      ),
      {
        kind: "domain_name_mismatch",
        domain: "keelinfra.com",
        importName: "Wrong Co",
      },
    );
  });

  it("returns multiple candidates warning", () => {
    assert.deepEqual(
      resolveImportRowMatchReason(
        baseRow({
          status: "needs_review",
          conflict_type: "multiple_candidates",
        }),
      ),
      { kind: "multiple_candidates" },
    );
  });
});

describe("getImportRowMatchedAlias", () => {
  it("returns null when match method is not alias", () => {
    assert.equal(
      getImportRowMatchedAlias(
        baseRow({
          match_method: "domain",
          raw_company_name: "Bitfarms",
        }),
      ),
      null,
    );
  });
});

describe("hasImportRowMatchReason", () => {
  it("is false for unmatched rows", () => {
    assert.equal(hasImportRowMatchReason(baseRow()), false);
  });

  it("is true when a match method is present", () => {
    assert.equal(
      hasImportRowMatchReason(
        baseRow({
          match_method: "exact_name",
        }),
      ),
      true,
    );
  });
});
