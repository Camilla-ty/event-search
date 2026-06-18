import { describe, expect, it } from "vitest";

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
    expect(
      resolveImportRowMatchReason(
        baseRow({
          match_method: "domain",
          normalized_domain: "keelinfra.com",
        }),
      ),
    ).toEqual({ kind: "domain", domain: "keelinfra.com" });
  });

  it("returns exact name match", () => {
    expect(
      resolveImportRowMatchReason(
        baseRow({
          match_method: "exact_name",
          raw_company_name: "Keel Infrastructure",
        }),
      ),
    ).toEqual({ kind: "exact_name" });
  });

  it("returns alias match with import company name", () => {
    expect(
      resolveImportRowMatchReason(
        baseRow({
          match_method: "alias",
          raw_company_name: "Bitfarms",
        }),
      ),
    ).toEqual({ kind: "alias", alias: "Bitfarms" });
  });

  it("returns domain/name mismatch warning context", () => {
    expect(
      resolveImportRowMatchReason(
        baseRow({
          status: "needs_review",
          conflict_type: "domain_name_mismatch",
          raw_company_name: "Wrong Co",
          normalized_domain: "keelinfra.com",
          proposed_company_id: "company-1",
        }),
      ),
    ).toEqual({
      kind: "domain_name_mismatch",
      domain: "keelinfra.com",
      importName: "Wrong Co",
    });
  });

  it("returns multiple candidates warning", () => {
    expect(
      resolveImportRowMatchReason(
        baseRow({
          status: "needs_review",
          conflict_type: "multiple_candidates",
        }),
      ),
    ).toEqual({ kind: "multiple_candidates" });
  });
});

describe("getImportRowMatchedAlias", () => {
  it("returns null when match method is not alias", () => {
    expect(
      getImportRowMatchedAlias(
        baseRow({
          match_method: "domain",
          raw_company_name: "Bitfarms",
        }),
      ),
    ).toBeNull();
  });
});

describe("hasImportRowMatchReason", () => {
  it("is false for unmatched rows", () => {
    expect(hasImportRowMatchReason(baseRow())).toBe(false);
  });

  it("is true when a match method is present", () => {
    expect(
      hasImportRowMatchReason(
        baseRow({
          match_method: "exact_name",
        }),
      ),
    ).toBe(true);
  });
});
