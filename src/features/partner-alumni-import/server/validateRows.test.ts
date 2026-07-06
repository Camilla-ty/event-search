import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assignDuplicateClusters, validateRow } from "./validateRows";

describe("partner alumni validateRow", () => {
  it("requires company name", () => {
    const result = validateRow({
      id: "row-1",
      excel_row_number: 3,
      raw_company_name: null,
      raw_website: "https://moonpay.com",
      raw_display_order: null,
      status: "needs_review",
    });

    assert.equal(result.has_blocking_validation, true);
    assert.ok(result.validation_issues.some((issue) => issue.type === "missing_company_name"));
  });

  it("uses resolveCompanyWebsiteIdentity — community URLs have null domain", () => {
    const result = validateRow({
      id: "row-2",
      excel_row_number: 4,
      raw_company_name: "Some Discord Server",
      raw_website: "https://discord.com/invite/example",
      raw_display_order: "12",
      status: "needs_review",
    });

    assert.equal(result.normalized_domain, null);
    assert.equal(result.has_blocking_validation, false);
    assert.ok(
      result.validation_issues.some(
        (issue) => issue.type === "community_website" && issue.severity === "warning",
      ),
    );
  });

  it("treats link3.to profile URLs as no_identity with distinct normalized websites", () => {
    const foo = validateRow({
      id: "row-link3-foo",
      excel_row_number: 10,
      raw_company_name: "Foo Project",
      raw_website: "https://link3.to/foo",
      raw_display_order: "1",
      status: "needs_review",
    });
    const bar = validateRow({
      id: "row-link3-bar",
      excel_row_number: 11,
      raw_company_name: "Bar Project",
      raw_website: "https://link3.to/bar",
      raw_display_order: "2",
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
      raw_display_order: null,
      status: "needs_review",
    });

    assert.equal(result.normalized_domain, null);
    assert.equal(result.normalized_website, "https://link3.to");
  });

  it("parses real URLs into normalized_domain", () => {
    const result = validateRow({
      id: "row-3",
      excel_row_number: 5,
      raw_company_name: "MoonPay",
      raw_website: "https://www.moonpay.com",
      raw_display_order: null,
      status: "needs_review",
    });

    assert.equal(result.normalized_domain, "moonpay.com");
    assert.equal(result.has_blocking_validation, false);
  });

  it("warns on invalid display order without blocking", () => {
    const result = validateRow({
      id: "row-4",
      excel_row_number: 6,
      raw_company_name: "Example Co",
      raw_website: "https://example.com",
      raw_display_order: "abc",
      status: "needs_review",
    });

    assert.equal(result.mapped_display_order, null);
    assert.equal(result.has_blocking_validation, false);
    assert.ok(result.validation_issues.some((issue) => issue.type === "invalid_display_order"));
  });
});

describe("partner alumni assignDuplicateClusters", () => {
  it("keeps one canonical row per shared domain", () => {
    const base = {
      normalized_company_name: "Acme",
      normalized_website: "https://acme.com",
      normalized_domain: "acme.com",
      proposed_slug: "acme",
      mapped_display_order: null,
      validation_issues: [],
      has_blocking_validation: false,
      status: "needs_review",
    };

    const rows = assignDuplicateClusters([
      { ...base, id: "a", excel_row_number: 2 },
      { ...base, id: "b", excel_row_number: 3 },
    ]);

    const canonical = rows.filter((row) => row.duplicate_role === "canonical");
    const duplicates = rows.filter((row) => row.duplicate_role === "duplicate");
    assert.equal(canonical.length, 1);
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0]?.duplicate_resolution, "excluded");
  });
});
