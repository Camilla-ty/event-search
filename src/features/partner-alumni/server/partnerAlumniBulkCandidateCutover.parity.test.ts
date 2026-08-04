import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildImportMatchContext } from "@/src/lib/companies/companyImportMatching";
import {
  createMemoryImportMatchCandidateSource,
  loadImportMatchContextFromCandidateSource,
  resolveImportMatchCandidateIdsFromSource,
  sortImportMatchCompanies,
  sortImportMatchCompanyDomains,
} from "@/src/lib/companies/importMatchCandidateLoader";
import { collectParityDiffs } from "@/src/lib/companies/importMatchParity/assertParity";
import {
  PHASE0_PARITY_FIXTURES,
  directoryForFixture,
} from "@/src/lib/companies/importMatchParity/fixtures";
import { runImportMatchShadowRow } from "@/src/lib/companies/importMatchShadow/runShadowRow";
import { assertImportMatchShadowEqual } from "@/src/lib/companies/importMatchShadow/compare";

import type { PartnerAlumniBulkInputRow } from "@/src/features/partner-alumni/lib/parsePartnerAlumniBulkSpreadsheet";
import {
  buildPartnerAlumniBulkPreviewRows,
  identityRowsFromBulkInput,
  resolvePartnerAlumniBulkMatchLoaderMode,
  type PartnerAlumniBulkPreviewRow,
} from "@/src/features/partner-alumni/server/partnerAlumniBulkImport";

async function loadCandidateContextWithNames(catalog: {
  companies: readonly {
    id: string;
    name: string;
    domain: string | null;
    website: string | null;
    aliases: readonly string[];
  }[];
  companyDomains: readonly { company_id: string; domain: string }[];
}, rows: readonly PartnerAlumniBulkInputRow[]) {
  const identityRows = identityRowsFromBulkInput(rows);
  const source = createMemoryImportMatchCandidateSource(catalog);
  const candidateIds = await resolveImportMatchCandidateIdsFromSource(source, identityRows);
  if (candidateIds.length === 0) {
    return {
      matchContext: buildImportMatchContext([], []),
      companyNameById: new Map<string, string>(),
    };
  }
  const [companies, companyDomains] = await Promise.all([
    source.findActiveCompaniesByIds(candidateIds),
    source.findCompanyDomainsByCompanyIds(candidateIds),
  ]);
  return {
    matchContext: buildImportMatchContext(
      sortImportMatchCompanies(companies),
      sortImportMatchCompanyDomains(companyDomains),
    ),
    companyNameById: new Map(companies.map((company) => [company.id, company.name])),
  };
}

function assertPreviewRowsEqual(
  actual: readonly PartnerAlumniBulkPreviewRow[],
  expected: readonly PartnerAlumniBulkPreviewRow[],
  label: string,
): void {
  assert.equal(actual.length, expected.length, `${label}: preview row count`);
  for (let index = 0; index < expected.length; index += 1) {
    const diffs = collectParityDiffs(actual[index], expected[index]);
    assert.equal(
      diffs.length,
      0,
      `${label}[${index}] row_number=${expected[index]?.row_number}:\n${diffs.map((d) => `  - ${d}`).join("\n")}`,
    );
  }
}

describe("resolvePartnerAlumniBulkMatchLoaderMode", () => {
  it("defaults to candidate (Phase 6 cutover)", () => {
    assert.equal(resolvePartnerAlumniBulkMatchLoaderMode({}), "candidate");
  });

  it("rolls back to full_directory via env", () => {
    assert.equal(
      resolvePartnerAlumniBulkMatchLoaderMode({
        PARTNER_ALUMNI_BULK_MATCH_LOADER: "full_directory",
      }),
      "full_directory",
    );
    assert.equal(
      resolvePartnerAlumniBulkMatchLoaderMode({
        PARTNER_ALUMNI_BULK_MATCH_LOADER: "full-directory",
      }),
      "full_directory",
    );
  });

  it("does not share Import / Sponsor / Exhibitor rollback envs", () => {
    assert.equal(
      resolvePartnerAlumniBulkMatchLoaderMode({
        PARTNER_ALUMNI_IMPORT_MATCH_LOADER: "full_directory",
        SPONSOR_IMPORT_MATCH_LOADER: "full_directory",
        EXHIBITOR_IMPORT_MATCH_LOADER: "full_directory",
      }),
      "candidate",
    );
  });
});

describe("ARC-003 Phase 6 partner alumni bulk candidate cutover parity", () => {
  it("requires 100% preview-field equality vs full-directory for all partner_alumni_bulk fixtures", async () => {
    const bulkFixtures = PHASE0_PARITY_FIXTURES.filter(
      (fixture) => fixture.expectedByImporter.partner_alumni_bulk !== undefined,
    );
    assert.ok(bulkFixtures.length > 0, "expected partner_alumni_bulk fixtures");

    for (const fixture of bulkFixtures) {
      const directory = directoryForFixture(fixture.id);
      const catalog = {
        companies: directory.companies,
        companyDomains: directory.companyDomains ?? [],
      };

      const inputRows: PartnerAlumniBulkInputRow[] = [];
      const name = fixture.input.row.normalized_company_name ?? "";
      const website = fixture.input.row.normalized_website;
      const displayOrder = fixture.input.row.mapped_display_order ?? null;

      if (fixture.input.row.has_blocking_validation) {
        inputRows.push({
          row_number: 1,
          name: "",
          website,
          display_order: displayOrder,
        });
      } else if (fixture.input.duplicate_in_file_kind === "identity_key") {
        inputRows.push(
          { row_number: 1, name, website, display_order: displayOrder },
          { row_number: 2, name, website, display_order: displayOrder },
        );
      } else if (fixture.input.duplicate_in_file_kind === "company_id") {
        // Two distinct identity keys that resolve to the same company.
        inputRows.push(
          {
            row_number: 1,
            name,
            website: website ?? (fixture.input.row.normalized_domain
              ? `https://${fixture.input.row.normalized_domain}`
              : null),
            display_order: displayOrder,
          },
          {
            row_number: 2,
            name: `${name} Alt`,
            website: website ?? (fixture.input.row.normalized_domain
              ? `https://${fixture.input.row.normalized_domain}`
              : null),
            display_order: displayOrder,
          },
        );
      } else {
        inputRows.push({
          row_number: 1,
          name,
          website,
          display_order: displayOrder,
        });
      }

      const rosterCompanyIds = new Set<string>();
      if (fixture.input.on_roster) {
        // Match production: on_roster when proposed company is already on version.
        const expected = fixture.expectedByImporter.partner_alumni_bulk;
        if (expected?.proposed_company_id) {
          rosterCompanyIds.add(expected.proposed_company_id);
        }
      }

      const fullContext = buildImportMatchContext(
        catalog.companies,
        catalog.companyDomains,
      );
      const fullNames = new Map(catalog.companies.map((c) => [c.id, c.name]));
      const candidate = await loadCandidateContextWithNames(catalog, inputRows);

      const fullPreview = buildPartnerAlumniBulkPreviewRows(
        inputRows,
        fullContext,
        fullNames,
        rosterCompanyIds,
      );
      const candidatePreview = buildPartnerAlumniBulkPreviewRows(
        inputRows,
        candidate.matchContext,
        candidate.companyNameById,
        rosterCompanyIds,
      );

      assertPreviewRowsEqual(
        candidatePreview,
        fullPreview,
        `partner_alumni_bulk cutover ${fixture.id}`,
      );

      // Also lock Phase 2 shadow shape for the primary (first) decision row when not a
      // multi-row synthetic identity duplicate (shadow models one row at a time).
      if (
        !fixture.input.duplicate_in_file_kind ||
        fixture.input.duplicate_in_file_kind === "company_id"
      ) {
        const shadowRow = {
          id: fixture.id,
          normalized_domain: fixture.input.row.normalized_domain,
          normalized_website: fixture.input.row.normalized_website,
          normalized_company_name: fixture.input.row.normalized_company_name,
          mapped_display_order: fixture.input.row.mapped_display_order ?? null,
          has_blocking_validation: fixture.input.row.has_blocking_validation ?? false,
          duplicate_in_file: fixture.input.duplicate_in_file ?? false,
          duplicate_in_file_kind: fixture.input.duplicate_in_file_kind,
          on_roster: fixture.input.on_roster ?? false,
        };
        const candidateContextOnly = await loadImportMatchContextFromCandidateSource(
          createMemoryImportMatchCandidateSource(catalog),
          [shadowRow],
        );
        const fullShadow = await runImportMatchShadowRow({
          importer: "partner_alumni_bulk",
          row: shadowRow,
          context: fullContext,
          overlays: { rosterCompanyIds },
        });
        const candidateShadow = await runImportMatchShadowRow({
          importer: "partner_alumni_bulk",
          row: shadowRow,
          context: candidateContextOnly,
          overlays: { rosterCompanyIds },
        });
        assertImportMatchShadowEqual(
          candidateShadow,
          fullShadow,
          `partner_alumni_bulk shadow cutover ${fixture.id}`,
        );
      }
    }
  });

  it("batch-level candidate context (union of keys) matches full-directory preview rows", async () => {
    const bulkFixtures = PHASE0_PARITY_FIXTURES.filter(
      (fixture) =>
        fixture.expectedByImporter.partner_alumni_bulk !== undefined &&
        !fixture.input.duplicate_in_file &&
        !fixture.input.row.has_blocking_validation,
    );

    const shared = directoryForFixture("exact-domain-canonical-name");
    const sharedFixtures = bulkFixtures.filter(
      (fixture) =>
        directoryForFixture(fixture.id) === shared ||
        directoryForFixture(fixture.id).companies === shared.companies,
    );

    const catalog = {
      companies: shared.companies,
      companyDomains: shared.companyDomains ?? [],
    };

    const inputRows: PartnerAlumniBulkInputRow[] = sharedFixtures.map((fixture, index) => ({
      row_number: index + 1,
      name: fixture.input.row.normalized_company_name ?? "",
      website: fixture.input.row.normalized_website,
      display_order: fixture.input.row.mapped_display_order ?? null,
    }));

    const rosterCompanyIds = new Set<string>();
    for (const fixture of sharedFixtures) {
      if (fixture.input.on_roster) {
        const expected = fixture.expectedByImporter.partner_alumni_bulk;
        if (expected?.proposed_company_id) {
          rosterCompanyIds.add(expected.proposed_company_id);
        }
      }
    }

    const fullContext = buildImportMatchContext(
      catalog.companies,
      catalog.companyDomains,
    );
    const fullNames = new Map(catalog.companies.map((c) => [c.id, c.name]));
    const candidate = await loadCandidateContextWithNames(catalog, inputRows);

    const fullPreview = buildPartnerAlumniBulkPreviewRows(
      inputRows,
      fullContext,
      fullNames,
      rosterCompanyIds,
    );
    const candidatePreview = buildPartnerAlumniBulkPreviewRows(
      inputRows,
      candidate.matchContext,
      candidate.companyNameById,
      rosterCompanyIds,
    );

    assertPreviewRowsEqual(
      candidatePreview,
      fullPreview,
      "partner_alumni_bulk batch-context",
    );
  });
});
