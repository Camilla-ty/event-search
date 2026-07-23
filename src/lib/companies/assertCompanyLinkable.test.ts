import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMPANY_NOT_LINKABLE_MESSAGE,
  assertCompanyLinkable,
  isCompanyLinkable,
} from "@/src/lib/companies/assertCompanyLinkable";

describe("isCompanyLinkable", () => {
  it("allows active companies without a merge target", () => {
    assert.equal(isCompanyLinkable({ status: "active", merged_into_company_id: null }), true);
  });

  it("rejects merged status and merge targets", () => {
    assert.equal(isCompanyLinkable({ status: "merged", merged_into_company_id: null }), false);
    assert.equal(
      isCompanyLinkable({
        status: "active",
        merged_into_company_id: "11111111-1111-1111-1111-111111111111",
      }),
      false,
    );
  });

  it("rejects missing company rows", () => {
    assert.equal(isCompanyLinkable(null), false);
    assert.equal(isCompanyLinkable(undefined), false);
  });
});

describe("assertCompanyLinkable", () => {
  it("throws a stable message when not linkable", () => {
    assert.throws(
      () => assertCompanyLinkable({ status: "merged", merged_into_company_id: null }),
      (error: unknown) =>
        error instanceof Error && error.message === COMPANY_NOT_LINKABLE_MESSAGE,
    );
  });

  it("does not throw for active companies", () => {
    assert.doesNotThrow(() =>
      assertCompanyLinkable({ status: "active", merged_into_company_id: null }),
    );
  });
});
