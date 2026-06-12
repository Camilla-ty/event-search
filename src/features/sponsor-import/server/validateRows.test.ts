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
});
