import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertImportMatchParityEqual,
  collectParityDiffs,
} from "@/src/lib/companies/importMatchParity/assertParity";
import {
  PHASE0_ORIGINAL_FIXTURE_IDS,
  PHASE0_PARITY_FIXTURES,
  PHASE0_REQUIRED_TAGS,
  PHASE01_REQUIRED_TAGS,
  directoryForFixture,
} from "@/src/lib/companies/importMatchParity/fixtures";
import { runGoldenImportMatchParity } from "@/src/lib/companies/importMatchParity/goldenReference";
import { assertParityAgainstGolden } from "@/src/lib/companies/importMatchParity/harness";
import type {
  ImportMatchParityDecision,
  ImportMatchParityImporter,
} from "@/src/lib/companies/importMatchParity/types";

describe("ARC-003 Phase 0 import match parity harness", () => {
  it("keeps all original Phase 0 fixtures", () => {
    const ids = new Set(PHASE0_PARITY_FIXTURES.map((fixture) => fixture.id));
    const missing = PHASE0_ORIGINAL_FIXTURE_IDS.filter((id) => !ids.has(id));
    assert.deepEqual(missing, [], `missing original Phase 0 fixtures: ${missing.join(", ")}`);
    assert.equal(PHASE0_ORIGINAL_FIXTURE_IDS.length, 18);
  });

  it("covers every required Phase 0 fixture tag", () => {
    const seen = new Set<string>();
    for (const fixture of PHASE0_PARITY_FIXTURES) {
      for (const tag of fixture.tags) seen.add(tag);
    }
    const missing = PHASE0_REQUIRED_TAGS.filter((tag) => !seen.has(tag));
    assert.deepEqual(missing, [], `missing required tags: ${missing.join(", ")}`);
  });

  it("covers every required Phase 0.1 fixture tag", () => {
    const seen = new Set<string>();
    for (const fixture of PHASE0_PARITY_FIXTURES) {
      for (const tag of fixture.tags) seen.add(tag);
    }
    const missing = PHASE01_REQUIRED_TAGS.filter((tag) => !seen.has(tag));
    assert.deepEqual(missing, [], `missing Phase 0.1 tags: ${missing.join(", ")}`);
  });

  it("locks golden-reference decisions for every fixture × importer expectation", async () => {
    const actualRows: ImportMatchParityDecision[] = [];
    const expectedRows: ImportMatchParityDecision[] = [];

    for (const fixture of PHASE0_PARITY_FIXTURES) {
      const importers = Object.keys(fixture.expectedByImporter) as ImportMatchParityImporter[];
      assert.ok(importers.length > 0, `fixture ${fixture.id} has no expected importers`);

      for (const importer of importers) {
        const expectedPartial = fixture.expectedByImporter[importer];
        assert.ok(expectedPartial, `missing expected for ${fixture.id}/${importer}`);

        const actual = await runGoldenImportMatchParity({
          fixture_id: fixture.id,
          importer,
          directory: directoryForFixture(fixture.id),
          ...fixture.input,
        });

        const expected: ImportMatchParityDecision = {
          fixture_id: fixture.id,
          importer,
          ...expectedPartial,
        };

        assertImportMatchParityEqual(actual, expected, `${fixture.id}/${importer}`);
        actualRows.push(actual);
        expectedRows.push(expected);
      }
    }

    assertParityAgainstGolden(actualRows, expectedRows, "phase0/0.1 golden lock");
  });

  it("fails with a clear field path when one decision field differs", () => {
    const base = {
      fixture_id: "diff-demo",
      importer: "sponsor" as const,
      status: "auto_ready",
      proposed_company_id: "a",
      proposed_company_name: "A",
      match_method: "domain" as const,
      match_confidence: "high" as const,
      conflict_type: null,
      intended_link_action: null,
      already_on_live_sponsor_id: null,
      already_on_live_exhibitor_id: null,
      already_on_live_tier_rank: null,
      intended_member_action: null,
      already_on_version_member_id: null,
      create_new_decision: false,
      bulk_preview_status: null,
      candidate_company_ids: ["a"],
      candidate_ordering: ["a"],
      duplicate_in_file: false,
      on_roster: false,
      duplicate_cluster_key: null,
      duplicate_role: null,
      duplicate_of_row_id: null,
      duplicate_resolution: null,
      persisted: {
        status: "auto_ready",
        match_method: "domain" as const,
        match_confidence: "high" as const,
        proposed_company_id: "a",
        conflict_type: null,
        intended_link_action: null,
        intended_member_action: null,
        already_on_live_sponsor_id: null,
        already_on_live_exhibitor_id: null,
        already_on_live_tier_rank: null,
        already_on_version_member_id: null,
        duplicate_cluster_key: null,
        duplicate_role: null,
        duplicate_of_row_id: null,
        duplicate_resolution: null,
      },
    };

    const diffs = collectParityDiffs(
      { ...base, match_method: "alias" },
      base,
    );
    assert.ok(diffs.some((line) => line.includes("match_method")));
  });
});
