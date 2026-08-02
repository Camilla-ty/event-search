import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createMemoryImportMatchCandidateSource,
  loadImportMatchContextFromCandidateSource,
  selectImportMatchCandidateCatalog,
  extractImportMatchLookupKeys,
} from "@/src/lib/companies/importMatchCandidateLoader";
import { assertImportMatchParityEqual } from "@/src/lib/companies/importMatchParity/assertParity";
import {
  PHASE0_ORIGINAL_FIXTURE_IDS,
  PHASE0_PARITY_FIXTURES,
  directoryForFixture,
} from "@/src/lib/companies/importMatchParity/fixtures";
import { runGoldenImportMatchParity } from "@/src/lib/companies/importMatchParity/goldenReference";
import type { ImportMatchParityImporter } from "@/src/lib/companies/importMatchParity/types";

describe("ARC-003 Phase 1 candidate loader parity vs Phase 0/0.1", () => {
  it("keeps all 28 Phase 0/0.1 fixtures", () => {
    assert.equal(PHASE0_PARITY_FIXTURES.length, 28);
    assert.equal(PHASE0_ORIGINAL_FIXTURE_IDS.length, 18);
  });

  it("candidate-only context decisions match full-directory golden for every fixture × importer", async () => {
    for (const fixture of PHASE0_PARITY_FIXTURES) {
      const fullDirectory = directoryForFixture(fixture.id);
      const catalog = {
        companies: fullDirectory.companies,
        companyDomains: fullDirectory.companyDomains ?? [],
      };
      const keys = extractImportMatchLookupKeys([fixture.input.row]);
      const candidateCatalog = selectImportMatchCandidateCatalog(keys, catalog);
      const memorySource = createMemoryImportMatchCandidateSource(catalog);

      // Source path and pure catalog path must agree on hydration size.
      const fromSource = await loadImportMatchContextFromCandidateSource(memorySource, [
        fixture.input.row,
      ]);
      assert.ok(fromSource);

      const importers = Object.keys(fixture.expectedByImporter) as ImportMatchParityImporter[];
      for (const importer of importers) {
        const full = await runGoldenImportMatchParity({
          fixture_id: fixture.id,
          importer,
          directory: fullDirectory,
          ...fixture.input,
        });

        const candidate = await runGoldenImportMatchParity({
          fixture_id: fixture.id,
          importer,
          directory: {
            companies: candidateCatalog.companies,
            companyDomains: candidateCatalog.companyDomains,
            // inactiveCompanies intentionally omitted — candidates never include them.
          },
          ...fixture.input,
        });

        assertImportMatchParityEqual(
          candidate,
          full,
          `phase1 candidate vs full ${fixture.id}/${importer}`,
        );
      }
    }
  });
});
