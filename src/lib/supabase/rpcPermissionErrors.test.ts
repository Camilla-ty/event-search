import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeRpcPermissionExpectation,
  isRpcBusinessRuleError,
  isRpcPermissionDenied,
} from "@/src/lib/supabase/rpcPermissionErrors";

describe("rpcPermissionErrors", () => {
  it("treats PostgreSQL 42501 as permission denied", () => {
    assert.equal(
      isRpcPermissionDenied({
        code: "42501",
        message: "permission denied for function merge_companies",
      }),
      true,
    );
    assert.equal(isRpcBusinessRuleError({ code: "42501", message: "x" }), false);
  });

  it("treats PostgREST PGRST301 as permission denied", () => {
    assert.equal(isRpcPermissionDenied({ code: "PGRST301", message: "permission denied" }), true);
  });

  it("treats P0001 as business rule error, not permission denied", () => {
    const error = { code: "P0001", message: "merge_performed_by_not_found" };
    assert.equal(isRpcBusinessRuleError(error), true);
    assert.equal(isRpcPermissionDenied(error), false);
    assert.equal(describeRpcPermissionExpectation(error), "business_rule_error");
  });

  it("classifies permission denied expectation", () => {
    assert.equal(
      describeRpcPermissionExpectation({
        code: "42501",
        message: "permission denied for function company_merge_preview",
      }),
      "permission_denied",
    );
  });
});
