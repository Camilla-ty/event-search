import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  summarizeMatchMethods,
  summarizeMaterializePreview,
  type ImportSummaryRow,
} from "./importSummary";

describe("partner alumni importSummary", () => {
  const rows: ImportSummaryRow[] = [
    {
      status: "resolved",
      match_method: "domain",
      decision_type: "use_matched",
      intended_member_action: "create_new_link",
    },
    {
      status: "resolved",
      match_method: "create_new",
      decision_type: "create_new",
      intended_member_action: "create_new_link",
    },
    {
      status: "resolved",
      match_method: "alias",
      decision_type: "use_matched",
      intended_member_action: "update_order",
    },
    {
      status: "needs_review",
      match_method: "exact_name",
      decision_type: null,
      intended_member_action: null,
    },
  ];

  it("counts resolved rows by match_method", () => {
    assert.deepEqual(summarizeMatchMethods(rows), {
      domain: 1,
      alias: 1,
      website: 0,
      exact_name: 0,
      manual: 0,
      create_new: 1,
    });
  });

  it("previews materialize actions for resolved rows", () => {
    assert.deepEqual(summarizeMaterializePreview(rows), {
      companies_to_create: 1,
      members_to_create: 2,
      members_to_update: 1,
      members_to_skip: 0,
    });
  });
});
