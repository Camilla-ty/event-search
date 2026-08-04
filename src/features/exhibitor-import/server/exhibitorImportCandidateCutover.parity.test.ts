import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildImportMatchContext } from "@/src/lib/companies/companyImportMatching";
import {
  createMemoryImportMatchCandidateSource,
  loadImportMatchContextFromCandidateSource,
} from "@/src/lib/companies/importMatchCandidateLoader";
import {
  assertImportMatchShadowEqual,
} from "@/src/lib/companies/importMatchShadow/compare";
import { runImportMatchShadowRow } from "@/src/lib/companies/importMatchShadow/runShadowRow";
import type { ImportMatchShadowPersistedDecision } from "@/src/lib/companies/importMatchShadow/types";
import {
  PHASE0_PARITY_FIXTURES,
  directoryForFixture,
} from "@/src/lib/companies/importMatchParity/fixtures";

import {
  matchRow,
  resolveExhibitorImportMatchLoaderMode,
  type MatchResult,
} from "./matchRows";

function persistedFromMatchResult(
  rowId: string,
  result: MatchResult,
): ImportMatchShadowPersistedDecision {
  return {
    row_id: rowId,
    importer: "exhibitor",
    status: result.status,
    match_method: result.match_method,
    match_confidence: result.match_confidence,
    proposed_company_id: result.proposed_company_id,
    conflict_type: result.conflict_type,
    intended_link_action: result.intended_link_action,
    already_on_live_sponsor_id: null,
    already_on_live_exhibitor_id: result.already_on_live_exhibitor_id,
    already_on_live_tier_rank: result.already_on_live_tier_rank,
    intended_member_action: null,
    already_on_version_member_id: null,
    bulk_preview_status: null,
  };
}

describe("resolveExhibitorImportMatchLoaderMode", () => {
  it("defaults to candidate (Phase 4B cutover)", () => {
    assert.equal(resolveExhibitorImportMatchLoaderMode({}), "candidate");
  });

  it("rolls back to full_directory via env", () => {
    assert.equal(
      resolveExhibitorImportMatchLoaderMode({
        EXHIBITOR_IMPORT_MATCH_LOADER: "full_directory",
      }),
      "full_directory",
    );
    assert.equal(
      resolveExhibitorImportMatchLoaderMode({
        EXHIBITOR_IMPORT_MATCH_LOADER: "full-directory",
      }),
      "full_directory",
    );
  });

  it("does not share Sponsor rollback env", () => {
    assert.equal(
      resolveExhibitorImportMatchLoaderMode({
        SPONSOR_IMPORT_MATCH_LOADER: "full_directory",
      }),
      "candidate",
    );
  });
});

describe("ARC-003 Phase 4B exhibitor candidate cutover parity", () => {
  it("requires 100% persisted-field equality vs full-directory for all exhibitor fixtures", async () => {
    const exhibitorFixtures = PHASE0_PARITY_FIXTURES.filter(
      (fixture) => fixture.expectedByImporter.exhibitor !== undefined,
    );
    assert.ok(exhibitorFixtures.length > 0, "expected exhibitor fixtures");

    for (const fixture of exhibitorFixtures) {
      const directory = directoryForFixture(fixture.id);
      const catalog = {
        companies: directory.companies,
        companyDomains: directory.companyDomains ?? [],
      };

      const row = {
        id: fixture.id,
        status: "needs_review" as const,
        normalized_domain: fixture.input.row.normalized_domain,
        normalized_website: fixture.input.row.normalized_website,
        normalized_company_name: fixture.input.row.normalized_company_name,
        mapped_tier_rank: fixture.input.row.mapped_tier_rank ?? null,
        has_blocking_validation: fixture.input.row.has_blocking_validation ?? false,
      };

      const liveByCompanyId = new Map(fixture.input.liveExhibitorsByCompanyId ?? []);

      const fullContext = buildImportMatchContext(
        catalog.companies,
        catalog.companyDomains,
      );
      const candidateContext = await loadImportMatchContextFromCandidateSource(
        createMemoryImportMatchCandidateSource(catalog),
        [row],
      );

      const fullResult = await matchRow(row, fullContext, liveByCompanyId);
      const candidateResult = await matchRow(row, candidateContext, liveByCompanyId);

      assertImportMatchShadowEqual(
        persistedFromMatchResult(fixture.id, candidateResult),
        persistedFromMatchResult(fixture.id, fullResult),
        `exhibitor cutover ${fixture.id}`,
      );

      const fullShadow = await runImportMatchShadowRow({
        importer: "exhibitor",
        row: {
          id: fixture.id,
          normalized_domain: row.normalized_domain,
          normalized_website: row.normalized_website,
          normalized_company_name: row.normalized_company_name,
          mapped_tier_rank: row.mapped_tier_rank,
          has_blocking_validation: row.has_blocking_validation,
        },
        context: fullContext,
        overlays: { liveExhibitorsByCompanyId: liveByCompanyId },
      });
      const candidateShadow = await runImportMatchShadowRow({
        importer: "exhibitor",
        row: {
          id: fixture.id,
          normalized_domain: row.normalized_domain,
          normalized_website: row.normalized_website,
          normalized_company_name: row.normalized_company_name,
          mapped_tier_rank: row.mapped_tier_rank,
          has_blocking_validation: row.has_blocking_validation,
        },
        context: candidateContext,
        overlays: { liveExhibitorsByCompanyId: liveByCompanyId },
      });
      assertImportMatchShadowEqual(
        candidateShadow,
        fullShadow,
        `exhibitor shadow cutover ${fixture.id}`,
      );
    }
  });

  it("batch-level candidate context (union of keys) matches full-directory for exhibitor fixtures", async () => {
    const exhibitorFixtures = PHASE0_PARITY_FIXTURES.filter(
      (fixture) => fixture.expectedByImporter.exhibitor !== undefined,
    );

    const shared = directoryForFixture("exact-domain-canonical-name");
    const sharedFixtures = exhibitorFixtures.filter(
      (fixture) =>
        directoryForFixture(fixture.id) === shared ||
        directoryForFixture(fixture.id).companies === shared.companies,
    );

    const catalog = {
      companies: shared.companies,
      companyDomains: shared.companyDomains ?? [],
    };
    const rows = sharedFixtures.map((fixture) => ({
      id: fixture.id,
      status: "needs_review" as const,
      normalized_domain: fixture.input.row.normalized_domain,
      normalized_website: fixture.input.row.normalized_website,
      normalized_company_name: fixture.input.row.normalized_company_name,
      mapped_tier_rank: fixture.input.row.mapped_tier_rank ?? null,
      has_blocking_validation: fixture.input.row.has_blocking_validation ?? false,
    }));

    const fullContext = buildImportMatchContext(
      catalog.companies,
      catalog.companyDomains,
    );
    const candidateContext = await loadImportMatchContextFromCandidateSource(
      createMemoryImportMatchCandidateSource(catalog),
      rows,
    );

    for (const row of rows) {
      const fixture = sharedFixtures.find((item) => item.id === row.id);
      const liveByCompanyId = new Map(fixture?.input.liveExhibitorsByCompanyId ?? []);
      const fullResult = await matchRow(row, fullContext, liveByCompanyId);
      const candidateResult = await matchRow(row, candidateContext, liveByCompanyId);
      assertImportMatchShadowEqual(
        persistedFromMatchResult(row.id, candidateResult),
        persistedFromMatchResult(row.id, fullResult),
        `exhibitor batch-context ${row.id}`,
      );
    }
  });
});
