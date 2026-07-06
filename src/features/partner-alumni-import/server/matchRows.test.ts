import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildImportMatchContextFromDirectory,
  matchRow,
} from "./matchRows";

describe("partner alumni matchRows", () => {
  it("matches by domain and flags existing version members", async () => {
    const context = buildImportMatchContextFromDirectory(
      [{ id: "company-1", name: "MoonPay", domain: "moonpay.com", aliases: null }],
      [{ company_id: "company-1", domain: "moonpay.com" }],
    );

    const memberByCompanyId = new Map([
      ["company-1", { id: "member-1", display_order: 5 }],
    ]);

    const result = await matchRow(
      {
        id: "row-1",
        status: "needs_review",
        normalized_domain: "moonpay.com",
        normalized_company_name: "MoonPay",
        mapped_display_order: 5,
        has_blocking_validation: false,
      },
      context,
      memberByCompanyId,
    );

    assert.equal(result.status, "auto_ready");
    assert.equal(result.match_method, "domain");
    assert.equal(result.proposed_company_id, "company-1");
    assert.equal(result.already_on_version_member_id, "member-1");
    assert.equal(result.intended_member_action, "skip");
  });

  it("returns null match_method when validation blocks the row", async () => {
    const context = buildImportMatchContextFromDirectory([], []);

    const result = await matchRow(
      {
        id: "row-2",
        status: "needs_review",
        normalized_domain: null,
        normalized_company_name: "Unknown",
        mapped_display_order: null,
        has_blocking_validation: true,
      },
      context,
      new Map(),
    );

    assert.equal(result.match_method, null);
    assert.equal(result.proposed_company_id, null);
  });
});
