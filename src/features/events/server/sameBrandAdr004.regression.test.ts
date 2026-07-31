import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function listFilesRecursive(dir: string, predicate: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, predicate));
      continue;
    }
    if (predicate(entry.name)) out.push(full);
  }
  return out;
}

const ROLE_AND_IMPORT_PATHS = [
  "src/features/events/server/eventSponsorAdmin.ts",
  "src/features/exhibitors/server/eventExhibitorAdmin.ts",
  "src/features/organizers/server/eventOrganizerAdmin.ts",
  "src/features/partner-alumni/server/partnerAlumniAdmin.ts",
  "src/features/sponsor-import/server/sponsorImportAdmin.ts",
  "src/features/exhibitor-import/server/exhibitorImportAdmin.ts",
  "src/features/partner-alumni-import/server/partnerAlumniImportAdmin.ts",
  "src/features/companies/server/companySponsorshipAdmin.ts",
] as const;

describe("ADR-004 SB3 regressions — roles and imports untouched", () => {
  for (const relativePath of ROLE_AND_IMPORT_PATHS) {
    it(`${relativePath} does not write company_profile_id`, () => {
      const source = readRepo(relativePath);
      assert.doesNotMatch(source, /company_profile_id/);
    });
  }

  it("does not introduce polymorphic sponsor / role targets toward event_series", () => {
    const sponsorAdmin = readRepo("src/features/events/server/eventSponsorAdmin.ts");
    const sponsorSchemaHints = [
      /sponsor_entity_type/,
      /target_type.*event_series/,
      /entity_type:\s*["']event_series["']/,
      /polymorphic/,
    ];
    for (const pattern of sponsorSchemaHints) {
      assert.doesNotMatch(sponsorAdmin, pattern);
    }

    const migrationDir = join(process.cwd(), "supabase/migrations");
    const migrations = listFilesRecursive(migrationDir, (name) => name.endsWith(".sql"));
    for (const file of migrations) {
      const sql = readFileSync(file, "utf8");
      assert.doesNotMatch(
        sql,
        /ALTER TABLE public\.event_sponsors[\s\S]{0,400}event_series_id/i,
      );
    }
  });

  it("has no automatic same-brand matching or backfill writers", () => {
    const autoLinkHints = [
      "src/lib/companies/sameBrandCompanyProfile.ts",
      "src/lib/companies/sameBrandPublicLink.ts",
      "src/features/events/server/sameBrandPublicLinks.ts",
      "src/features/events/server/eventSeriesAdmin.ts",
      "src/app/api/admin/event-series/[id]/route.ts",
    ];
    for (const relativePath of autoLinkHints) {
      const source = readRepo(relativePath);
      assert.doesNotMatch(source, /auto[_-]?link/i);
      assert.doesNotMatch(source, /backfill.*company_profile_id/i);
      assert.doesNotMatch(source, /match.*company_profile_id.*=/i);
    }

    const migration = readRepo(
      "supabase/migrations/20260731120000_event_series_company_profile_id.sql",
    );
    assert.doesNotMatch(migration, /UPDATE\s+public\.event_series/i);
    assert.doesNotMatch(migration, /SET\s+company_profile_id\s*=/i);
  });
});

describe("ADR-004 SB3 regressions — public + admin wiring intact", () => {
  it("series hub loads a safe same-brand company link only", () => {
    const loader = readRepo("src/features/events/server/getSeriesHubData.ts");
    const publicLinks = readRepo("src/features/events/server/sameBrandPublicLinks.ts");
    const header = readRepo(
      "src/features/events/components/series/SeriesHubHeader.tsx",
    );
    const page = readRepo("src/app/(marketing)/events/series/[slug]/page.tsx");

    assert.match(loader, /loadPublicSameBrandCompanyLinkForSeries/);
    assert.match(loader, /sameBrandCompanyLink/);
    assert.match(publicLinks, /\.eq\("status", "active"\)/);
    assert.match(publicLinks, /\.is\("restricted_at", null\)/);
    assert.match(publicLinks, /buildPublicSameBrandCompanyLink/);
    assert.match(header, /Company profile/);
    assert.doesNotMatch(header, /organizer|owner/i);
    assert.match(page, /sameBrandCompanyLink=\{data\.sameBrandCompanyLink\}/);
  });

  it("company profile loads a safe same-brand series link for anonymous users", () => {
    const loader = readRepo("src/features/sponsors/server/getSponsorDetailData.ts");
    const view = readRepo(
      "src/features/sponsors/components/detail/SponsorDetailView.tsx",
    );

    assert.match(loader, /loadPublicSameBrandSeriesLinkForCompany/);
    assert.match(loader, /sameBrandSeriesLink/);
    // Anonymous branch must still carry the reciprocal link.
    assert.match(
      loader,
      /isAuthenticated:\s*false[\s\S]*?sameBrandSeriesLink/m,
    );
    assert.match(view, /Event profile/);
    assert.match(view, /sameBrandSeriesLink/);
  });

  it("admin PATCH remains the only mutation path and stays admin-gated", () => {
    const route = readRepo("src/app/api/admin/event-series/[id]/route.ts");
    assert.match(route, /requireAdminApi/);
    assert.match(route, /validateSameBrandCompanyProfileAssignment/);
    assert.match(route, /company_profile_id/);
  });

  it("series hub metadata path does not depend on same-brand payloads", () => {
    const page = readRepo("src/app/(marketing)/events/series/[slug]/page.tsx");
    const metadataFn = page.slice(
      page.indexOf("export async function generateMetadata"),
      page.indexOf("export default async function SeriesHubPage"),
    );
    assert.doesNotMatch(metadataFn, /sameBrand/);
    assert.match(metadataFn, /resolveSeriesPublicAccess/);
  });
});
