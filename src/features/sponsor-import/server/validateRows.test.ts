import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateRow } from "./validateRows";

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
