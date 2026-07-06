import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeRows, type ImportRowRecord } from "./batchGuards";
import { assignDuplicateClusters, validateRow, type ValidatedImportRow } from "./validateRows";

describe("validateRow", () => {
  it("allows blank website when name and tier are present", () => {
    const result = validateRow({
      id: "row-1",
      excel_row_number: 2,
      raw_company_name: "Community Project",
      raw_website: null,
      raw_tier_rank: 2,
      raw_tier_label: null,
      status: "needs_review",
    });

    assert.equal(result.has_blocking_validation, false);
    assert.equal(result.normalized_website, null);
    assert.equal(result.normalized_domain, null);
    assert.ok(
      result.validation_issues.some(
        (issue) => issue.type === "missing_website" && issue.severity === "warning",
      ),
    );
  });

  it("still blocks website values that cannot be parsed into a domain", () => {
    const result = validateRow({
      id: "row-2",
      excel_row_number: 3,
      raw_company_name: "Bad URL Co",
      raw_website: "https://",
      raw_tier_rank: 1,
      raw_tier_label: null,
      status: "needs_review",
    });

    assert.equal(result.has_blocking_validation, true);
    assert.ok(
      result.validation_issues.some(
        (issue) => issue.type === "invalid_website" && issue.severity === "blocking",
      ),
    );
  });

  it("flags community/social URLs with a non-blocking warning and null domain", () => {
    const result = validateRow({
      id: "row-3",
      excel_row_number: 4,
      raw_company_name: "Some Discord Server",
      raw_website: "https://discord.com/invite/qx2Vy5GCZ7",
      raw_tier_rank: 1,
      raw_tier_label: null,
      status: "needs_review",
    });

    assert.equal(result.has_blocking_validation, false);
    assert.equal(result.normalized_domain, null);
    assert.ok(
      result.validation_issues.some(
        (issue) => issue.type === "community_website" && issue.severity === "warning",
      ),
    );
  });

  it("does not collapse distinct community URLs onto a shared bare host", () => {
    const discordA = validateRow({
      id: "row-4",
      excel_row_number: 5,
      raw_company_name: "Server A",
      raw_website: "https://discord.gg/aaaa",
      raw_tier_rank: 1,
      raw_tier_label: null,
      status: "needs_review",
    });
    const instagram = validateRow({
      id: "row-5",
      excel_row_number: 6,
      raw_company_name: "Brand B",
      raw_website: "https://instagram.com/brandb",
      raw_tier_rank: 1,
      raw_tier_label: null,
      status: "needs_review",
    });

    assert.equal(discordA.normalized_domain, null);
    assert.equal(instagram.normalized_domain, null);
  });

  it("treats link3.to profile URLs as no_identity with distinct normalized websites", () => {
    const foo = validateRow({
      id: "row-link3-foo",
      excel_row_number: 10,
      raw_company_name: "Foo Project",
      raw_website: "https://link3.to/foo",
      raw_tier_rank: 1,
      raw_tier_label: null,
      status: "needs_review",
    });
    const bar = validateRow({
      id: "row-link3-bar",
      excel_row_number: 11,
      raw_company_name: "Bar Project",
      raw_website: "https://link3.to/bar",
      raw_tier_rank: 1,
      raw_tier_label: null,
      status: "needs_review",
    });

    assert.equal(foo.normalized_domain, null);
    assert.equal(bar.normalized_domain, null);
    assert.equal(foo.normalized_website, "https://link3.to/foo");
    assert.equal(bar.normalized_website, "https://link3.to/bar");
    assert.ok(
      foo.validation_issues.some(
        (issue) => issue.type === "community_website" && issue.severity === "warning",
      ),
    );
  });

  it("rejects bare link3.to host as normalized_domain", () => {
    const result = validateRow({
      id: "row-link3-bare",
      excel_row_number: 12,
      raw_company_name: "Example",
      raw_website: "https://link3.to",
      raw_tier_rank: 1,
      raw_tier_label: null,
      status: "needs_review",
    });

    assert.equal(result.normalized_domain, null);
    assert.equal(result.normalized_website, "https://link3.to");
  });

  it("keeps path-aware identity for hosted marketplace and LinkedIn company URLs", () => {
    const opensea = validateRow({
      id: "row-6",
      excel_row_number: 7,
      raw_company_name: "Nekocore",
      raw_website: "https://opensea.io/collection/nekocore",
      raw_tier_rank: 1,
      raw_tier_label: null,
      status: "needs_review",
    });
    const linkedin = validateRow({
      id: "row-7",
      excel_row_number: 8,
      raw_company_name: "Atlantic HPC",
      raw_website: "https://www.linkedin.com/company/atlantic-hpc/",
      raw_tier_rank: 1,
      raw_tier_label: null,
      status: "needs_review",
    });

    assert.equal(opensea.normalized_domain, "opensea.io/collection/nekocore");
    assert.equal(linkedin.normalized_domain, "linkedin.com/company/atlantic-hpc");
    assert.equal(opensea.has_blocking_validation, false);
    assert.equal(linkedin.has_blocking_validation, false);
  });
});

describe("assignDuplicateClusters", () => {
  function row(params: {
    id: string;
    excel_row_number: number;
    name?: string;
    domain?: string;
    tier: number;
  }): ValidatedImportRow {
    return {
      id: params.id,
      excel_row_number: params.excel_row_number,
      status: "needs_review",
      normalized_company_name: params.name ?? "Google",
      normalized_website: null,
      normalized_domain: params.domain ?? "google.com",
      proposed_slug: "google",
      mapped_tier_rank: params.tier,
      mapped_tier_label: null,
      validation_issues: [],
      has_blocking_validation: false,
      duplicate_cluster_key: null,
      duplicate_role: null,
      duplicate_of_row_id: null,
      duplicate_resolution: null,
    };
  }

  function summaryRows(rows: ValidatedImportRow[]): ImportRowRecord[] {
    return rows.map((r) => ({
      id: r.id,
      status: r.duplicate_resolution === "excluded" ? "excluded" : "needs_review",
      has_blocking_validation: r.has_blocking_validation,
      duplicate_role: r.duplicate_role,
      duplicate_resolution: r.duplicate_resolution,
    }));
  }

  it("automatically keeps the highest sponsorship tier in a duplicate cluster", () => {
    const rows = assignDuplicateClusters([
      row({ id: "row-1", excel_row_number: 10, tier: 3 }),
      row({ id: "row-2", excel_row_number: 11, tier: 1 }),
      row({ id: "row-3", excel_row_number: 12, tier: 2 }),
    ]);

    assert.equal(rows.find((r) => r.id === "row-2")?.duplicate_resolution, "kept");
    assert.equal(rows.find((r) => r.id === "row-1")?.duplicate_resolution, "excluded");
    assert.equal(rows.find((r) => r.id === "row-3")?.duplicate_resolution, "excluded");
    assert.equal(summarizeRows(summaryRows(rows)).pending_duplicate_count, 0);
  });

  it("keeps the first occurrence when duplicate rows have the same tier", () => {
    const rows = assignDuplicateClusters([
      row({ id: "row-1", excel_row_number: 10, tier: 2 }),
      row({ id: "row-2", excel_row_number: 11, tier: 2 }),
    ]);

    assert.equal(rows.find((r) => r.id === "row-1")?.duplicate_resolution, "kept");
    assert.equal(rows.find((r) => r.id === "row-2")?.duplicate_resolution, "excluded");
    assert.equal(rows.find((r) => r.id === "row-2")?.duplicate_of_row_id, "row-1");
    assert.equal(summarizeRows(summaryRows(rows)).pending_duplicate_count, 0);
  });
});
