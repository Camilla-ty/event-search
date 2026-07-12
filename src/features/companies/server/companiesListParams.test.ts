import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyCompaniesListFilterChange,
  applyCompaniesListSearchChange,
  buildCompaniesListParamsKey,
  shouldApplyCompaniesListFetchResult,
} from "@/src/features/companies/client/companiesListCollectionState";
import {
  buildCompaniesListSearchParams,
  parseCompaniesListParams,
  parseCompanyListFilter,
} from "@/src/features/companies/server/companiesListParams";

describe("parseCompanyListFilter", () => {
  it("falls back to all for invalid filter values", () => {
    assert.equal(parseCompanyListFilter(undefined), "all");
    assert.equal(parseCompanyListFilter("unknown"), "all");
    assert.equal(parseCompanyListFilter("missing_logo"), "missing_logo");
  });
});

describe("parseCompaniesListParams", () => {
  it("round-trips filter and search params", () => {
    const parsed = parseCompaniesListParams(
      new URLSearchParams("filter=missing_logo&search=acme"),
    );
    assert.deepEqual(parsed, {
      filter: "missing_logo",
      search: "acme",
    });

    const serialized = buildCompaniesListSearchParams(parsed);
    assert.equal(serialized.toString(), "filter=missing_logo&search=acme");
    assert.deepEqual(parseCompaniesListParams(serialized), parsed);
  });

  it("omits default filter and empty search from serialized params", () => {
    const serialized = buildCompaniesListSearchParams({ filter: "all", search: "" });
    assert.equal(serialized.toString(), "");
  });
});

describe("companies list collection state", () => {
  it("preserves search when filter changes", () => {
    const next = applyCompaniesListFilterChange(
      { filter: "all", search: "acme" },
      "missing_logo",
    );
    assert.deepEqual(next, { filter: "missing_logo", search: "acme" });
  });

  it("trims search on submit", () => {
    const next = applyCompaniesListSearchChange(
      { filter: "all", search: "" },
      "  acme  ",
    );
    assert.equal(next.search, "acme");
  });

  it("clears search", () => {
    const next = applyCompaniesListSearchChange(
      { filter: "social_website", search: "beta" },
      "",
    );
    assert.equal(next.search, "");
    assert.equal(next.filter, "social_website");
  });

  it("builds stable params keys", () => {
    assert.equal(
      buildCompaniesListParamsKey({ filter: "all", search: "acme" }),
      buildCompaniesListParamsKey({ filter: "all", search: "acme" }),
    );
    assert.notEqual(
      buildCompaniesListParamsKey({ filter: "all", search: "acme" }),
      buildCompaniesListParamsKey({ filter: "missing_logo", search: "acme" }),
    );
  });

  it("ignores stale fetch results", () => {
    assert.equal(shouldApplyCompaniesListFetchResult(1, 2), false);
    assert.equal(shouldApplyCompaniesListFetchResult(2, 2), true);
  });
});
