import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertImportMatchShadowEqual,
  shadowCompareAgainstCatalog,
} from "@/src/lib/companies/importMatchShadow";
import {
  PHASE0_PARITY_FIXTURES,
  directoryForFixture,
} from "@/src/lib/companies/importMatchParity/fixtures";
import type { ImportMatchParityImporter } from "@/src/lib/companies/importMatchParity/types";
import type { ImportMatchShadowRowInput } from "@/src/lib/companies/importMatchShadow/types";

const ALL_IMPORTERS: ImportMatchParityImporter[] = [
  "sponsor",
  "exhibitor",
  "partner_alumni",
  "partner_alumni_bulk",
];

describe("ARC-003 Phase 2 import match shadow compare", () => {
  it("fails with a clear persisted-field diff when one field differs", () => {
    const base = {
      row_id: "r1",
      importer: "sponsor" as const,
      status: "auto_ready",
      match_method: "domain" as const,
      match_confidence: "high" as const,
      proposed_company_id: "a",
      conflict_type: null,
      intended_link_action: "create_new_link" as const,
      already_on_live_sponsor_id: null,
      already_on_live_exhibitor_id: null,
      already_on_live_tier_rank: null,
      intended_member_action: null,
      already_on_version_member_id: null,
      bulk_preview_status: null,
    };

    assert.throws(
      () =>
        assertImportMatchShadowEqual(
          { ...base, match_method: "alias" },
          base,
          "demo",
        ),
      /match_method/,
    );
  });

  it("full-directory vs candidate loader agree on persisted fields for all Phase 0/0.1 fixtures × importers", async () => {
    for (const fixture of PHASE0_PARITY_FIXTURES) {
      const directory = directoryForFixture(fixture.id);
      const catalog = {
        companies: directory.companies,
        companyDomains: directory.companyDomains ?? [],
      };

      const row: ImportMatchShadowRowInput = {
        id: fixture.id,
        normalized_domain: fixture.input.row.normalized_domain,
        normalized_website: fixture.input.row.normalized_website,
        normalized_company_name: fixture.input.row.normalized_company_name,
        mapped_tier_rank: fixture.input.row.mapped_tier_rank ?? null,
        mapped_display_order: fixture.input.row.mapped_display_order ?? null,
        has_blocking_validation: fixture.input.row.has_blocking_validation ?? false,
        on_roster: fixture.input.on_roster,
        duplicate_in_file: fixture.input.duplicate_in_file,
        duplicate_in_file_kind: fixture.input.duplicate_in_file_kind,
      };

      const expectedImporters = Object.keys(
        fixture.expectedByImporter,
      ) as ImportMatchParityImporter[];
      const importers =
        expectedImporters.length > 0 ? expectedImporters : ALL_IMPORTERS;

      for (const importer of importers) {
        await shadowCompareAgainstCatalog({
          importer,
          rows: [row],
          catalog,
          overlays: {
            liveSponsorsByCompanyId: fixture.input.liveSponsorsByCompanyId,
            liveExhibitorsByCompanyId: fixture.input.liveExhibitorsByCompanyId,
            versionMembersByCompanyId: fixture.input.versionMembersByCompanyId,
          },
          batchId: `fixture:${fixture.id}`,
        });
      }
    }
  });
});
