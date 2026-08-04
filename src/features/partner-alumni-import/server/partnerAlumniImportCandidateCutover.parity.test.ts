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
  resolvePartnerAlumniImportMatchLoaderMode,
  type MatchResult,
} from "./matchRows";

function persistedFromMatchResult(
  rowId: string,
  result: MatchResult,
): ImportMatchShadowPersistedDecision {
  return {
    row_id: rowId,
    importer: "partner_alumni",
    status: result.status,
    match_method: result.match_method,
    match_confidence: result.match_confidence,
    proposed_company_id: result.proposed_company_id,
    conflict_type: result.conflict_type,
    intended_link_action: null,
    already_on_live_sponsor_id: null,
    already_on_live_exhibitor_id: null,
    already_on_live_tier_rank: null,
    intended_member_action: result.intended_member_action,
    already_on_version_member_id: result.already_on_version_member_id,
    bulk_preview_status: null,
  };
}

describe("resolvePartnerAlumniImportMatchLoaderMode", () => {
  it("defaults to candidate (Phase 5B cutover)", () => {
    assert.equal(resolvePartnerAlumniImportMatchLoaderMode({}), "candidate");
  });

  it("rolls back to full_directory via env", () => {
    assert.equal(
      resolvePartnerAlumniImportMatchLoaderMode({
        PARTNER_ALUMNI_IMPORT_MATCH_LOADER: "full_directory",
      }),
      "full_directory",
    );
    assert.equal(
      resolvePartnerAlumniImportMatchLoaderMode({
        PARTNER_ALUMNI_IMPORT_MATCH_LOADER: "full-directory",
      }),
      "full_directory",
    );
  });

  it("does not share Sponsor or Exhibitor rollback envs", () => {
    assert.equal(
      resolvePartnerAlumniImportMatchLoaderMode({
        SPONSOR_IMPORT_MATCH_LOADER: "full_directory",
        EXHIBITOR_IMPORT_MATCH_LOADER: "full_directory",
      }),
      "candidate",
    );
  });
});

describe("ARC-003 Phase 5B partner alumni import candidate cutover parity", () => {
  it("requires 100% persisted-field equality vs full-directory for all partner_alumni fixtures", async () => {
    const paFixtures = PHASE0_PARITY_FIXTURES.filter(
      (fixture) => fixture.expectedByImporter.partner_alumni !== undefined,
    );
    assert.ok(paFixtures.length > 0, "expected partner_alumni fixtures");

    for (const fixture of paFixtures) {
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
        mapped_display_order: fixture.input.row.mapped_display_order ?? null,
        has_blocking_validation: fixture.input.row.has_blocking_validation ?? false,
      };

      const memberByCompanyId = new Map(fixture.input.versionMembersByCompanyId ?? []);

      const fullContext = buildImportMatchContext(
        catalog.companies,
        catalog.companyDomains,
      );
      const candidateContext = await loadImportMatchContextFromCandidateSource(
        createMemoryImportMatchCandidateSource(catalog),
        [row],
      );

      const fullResult = await matchRow(row, fullContext, memberByCompanyId);
      const candidateResult = await matchRow(row, candidateContext, memberByCompanyId);

      assertImportMatchShadowEqual(
        persistedFromMatchResult(fixture.id, candidateResult),
        persistedFromMatchResult(fixture.id, fullResult),
        `partner_alumni cutover ${fixture.id}`,
      );

      const fullShadow = await runImportMatchShadowRow({
        importer: "partner_alumni",
        row: {
          id: fixture.id,
          normalized_domain: row.normalized_domain,
          normalized_website: row.normalized_website,
          normalized_company_name: row.normalized_company_name,
          mapped_display_order: row.mapped_display_order,
          has_blocking_validation: row.has_blocking_validation,
        },
        context: fullContext,
        overlays: { versionMembersByCompanyId: memberByCompanyId },
      });
      const candidateShadow = await runImportMatchShadowRow({
        importer: "partner_alumni",
        row: {
          id: fixture.id,
          normalized_domain: row.normalized_domain,
          normalized_website: row.normalized_website,
          normalized_company_name: row.normalized_company_name,
          mapped_display_order: row.mapped_display_order,
          has_blocking_validation: row.has_blocking_validation,
        },
        context: candidateContext,
        overlays: { versionMembersByCompanyId: memberByCompanyId },
      });
      assertImportMatchShadowEqual(
        candidateShadow,
        fullShadow,
        `partner_alumni shadow cutover ${fixture.id}`,
      );
    }
  });

  it("batch-level candidate context (union of keys) matches full-directory for partner_alumni fixtures", async () => {
    const paFixtures = PHASE0_PARITY_FIXTURES.filter(
      (fixture) => fixture.expectedByImporter.partner_alumni !== undefined,
    );

    const shared = directoryForFixture("exact-domain-canonical-name");
    const sharedFixtures = paFixtures.filter(
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
      mapped_display_order: fixture.input.row.mapped_display_order ?? null,
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
      const memberByCompanyId = new Map(fixture?.input.versionMembersByCompanyId ?? []);
      const fullResult = await matchRow(row, fullContext, memberByCompanyId);
      const candidateResult = await matchRow(row, candidateContext, memberByCompanyId);
      assertImportMatchShadowEqual(
        persistedFromMatchResult(row.id, candidateResult),
        persistedFromMatchResult(row.id, fullResult),
        `partner_alumni batch-context ${row.id}`,
      );
    }
  });
});
