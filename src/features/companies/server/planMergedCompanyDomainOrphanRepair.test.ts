import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planMergedCompanyDomainOrphanRepair } from "@/src/features/companies/server/planMergedCompanyDomainOrphanRepair";

const MERGED = "mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm";
const CANONICAL = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const THIRD = "tttttttt-tttt-tttt-tttt-tttttttttttt";

describe("planMergedCompanyDomainOrphanRepair", () => {
  it("moves as alias when canonical primary differs", () => {
    const decision = planMergedCompanyDomainOrphanRepair({
      mergedCompanyId: MERGED,
      mergedName: "Gate.io (merged)",
      canonicalCompanyId: CANONICAL,
      canonicalName: "Gate.io",
      canonicalDomain: "gate.com",
      orphan: {
        id: "row1",
        company_id: MERGED,
        domain: "gate.io",
        is_primary: true,
      },
      canonicalAlreadyHasIdentity: false,
      foreignOwnersOfIdentity: [],
    });

    assert.equal(decision.status, "repair");
    if (decision.status === "repair") {
      assert.equal(decision.action, "move_as_alias");
    }
  });

  it("moves and sets primary when identity matches companies.domain", () => {
    const decision = planMergedCompanyDomainOrphanRepair({
      mergedCompanyId: MERGED,
      mergedName: "Aptos Foundation (merged)",
      canonicalCompanyId: CANONICAL,
      canonicalName: "Aptos",
      canonicalDomain: "aptosnetwork.com",
      orphan: {
        id: "row1",
        company_id: MERGED,
        domain: "aptosnetwork.com",
        is_primary: true,
      },
      canonicalAlreadyHasIdentity: false,
      foreignOwnersOfIdentity: [],
    });

    assert.equal(decision.status, "repair");
    if (decision.status === "repair") {
      assert.equal(decision.action, "move_and_set_primary");
    }
  });

  it("deletes overlap when canonical already has the row", () => {
    const decision = planMergedCompanyDomainOrphanRepair({
      mergedCompanyId: MERGED,
      mergedName: "Dup (merged)",
      canonicalCompanyId: CANONICAL,
      canonicalName: "Keep",
      canonicalDomain: "keep.com",
      orphan: {
        id: "row1",
        company_id: MERGED,
        domain: "keep.com",
        is_primary: true,
      },
      canonicalAlreadyHasIdentity: true,
      foreignOwnersOfIdentity: [],
    });

    assert.equal(decision.status, "repair");
    if (decision.status === "repair") {
      assert.equal(decision.action, "delete_overlap");
    }
  });

  it("skips third-party conflicts", () => {
    const decision = planMergedCompanyDomainOrphanRepair({
      mergedCompanyId: MERGED,
      mergedName: "X (merged)",
      canonicalCompanyId: CANONICAL,
      canonicalName: "Y",
      canonicalDomain: "y.com",
      orphan: {
        id: "row1",
        company_id: MERGED,
        domain: "taken.com",
        is_primary: true,
      },
      canonicalAlreadyHasIdentity: false,
      foreignOwnersOfIdentity: [{ company_id: THIRD }],
    });

    assert.equal(decision.status, "skipped_conflict");
  });
});
