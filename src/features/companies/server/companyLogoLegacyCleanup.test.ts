import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLogoUrlReferenceCounts,
  isLegacyCompanyLogoStoragePath,
  legacyLogoPathsForDomain,
  planLegacyCompanyLogoCleanup,
} from "@/src/features/companies/server/companyLogoLegacyCleanup";

const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";
const BASE_URL = "https://example.supabase.co/storage/v1/object/public/company-logos";

describe("isLegacyCompanyLogoStoragePath", () => {
  it("identifies domain-based legacy paths", () => {
    assert.equal(isLegacyCompanyLogoStoragePath("companies/acme.com/logo.png"), true);
    assert.equal(
      isLegacyCompanyLogoStoragePath(`companies/${COMPANY_ID}/logo.png`),
      false,
    );
  });
});

describe("legacyLogoPathsForDomain", () => {
  it("builds logo file paths from a domain folder listing", () => {
    const paths = legacyLogoPathsForDomain("Acme.com", ["logo.png", "notes.txt", "logo.webp"]);
    assert.deepEqual(paths, ["companies/acme.com/logo.png", "companies/acme.com/logo.webp"]);
  });
});

describe("buildLogoUrlReferenceCounts", () => {
  it("counts companies referencing each storage path", () => {
    const counts = buildLogoUrlReferenceCounts([
      {
        id: COMPANY_ID,
        name: "Acme",
        domain: "acme.com",
        logo_url: `${BASE_URL}/companies/${COMPANY_ID}/logo.png`,
      },
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Other",
        domain: "acme.com",
        logo_url: `${BASE_URL}/companies/acme.com/logo.png`,
      },
    ]);

    assert.equal(counts.get(`companies/${COMPANY_ID}/logo.png`), 1);
    assert.equal(counts.get("companies/acme.com/logo.png"), 1);
  });
});

describe("planLegacyCompanyLogoCleanup", () => {
  const activeRow = {
    id: COMPANY_ID,
    name: "Acme Corp",
    domain: "acme.com",
    logo_url: `${BASE_URL}/companies/${COMPANY_ID}/logo.webp`,
  };

  it("plans deletion when active companyId logo exists and legacy is unreferenced", () => {
    const items = planLegacyCompanyLogoCleanup({
      row: activeRow,
      activeObjectExists: true,
      activeObjectByteLength: 1024,
      legacyCandidatePaths: ["companies/acme.com/logo.png"],
      logoUrlReferenceCounts: buildLogoUrlReferenceCounts([activeRow]),
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.kind, "delete");
    if (items[0]?.kind === "delete") {
      assert.equal(items[0].plan.legacyStoragePath, "companies/acme.com/logo.png");
      assert.equal(items[0].plan.activeStoragePath, `companies/${COMPANY_ID}/logo.webp`);
    }
  });

  it("skips when logo_url still points to a legacy path", () => {
    const items = planLegacyCompanyLogoCleanup({
      row: {
        ...activeRow,
        logo_url: `${BASE_URL}/companies/acme.com/logo.png`,
      },
      activeObjectExists: true,
      activeObjectByteLength: 1024,
      legacyCandidatePaths: ["companies/acme.com/logo.png"],
      logoUrlReferenceCounts: new Map(),
    });

    assert.deepEqual(items, [{ kind: "skip", reason: "logo_url_not_company_id_path" }]);
  });

  it("skips legacy objects still referenced by another company", () => {
    const items = planLegacyCompanyLogoCleanup({
      row: activeRow,
      activeObjectExists: true,
      activeObjectByteLength: 1024,
      legacyCandidatePaths: ["companies/acme.com/logo.png"],
      logoUrlReferenceCounts: buildLogoUrlReferenceCounts([
        activeRow,
        {
          id: "11111111-1111-1111-1111-111111111111",
          name: "Other",
          domain: "acme.com",
          logo_url: `${BASE_URL}/companies/acme.com/logo.png`,
        },
      ]),
    });

    assert.equal(items[0]?.kind, "skip");
    if (items[0]?.kind === "skip") {
      assert.equal(items[0].reason, "legacy_still_referenced");
    }
  });

  it("skips when the active object is missing or empty", () => {
    const missing = planLegacyCompanyLogoCleanup({
      row: activeRow,
      activeObjectExists: false,
      activeObjectByteLength: 0,
      legacyCandidatePaths: ["companies/acme.com/logo.png"],
      logoUrlReferenceCounts: new Map(),
    });
    assert.deepEqual(missing, [{ kind: "skip", reason: "active_object_missing" }]);

    const empty = planLegacyCompanyLogoCleanup({
      row: activeRow,
      activeObjectExists: true,
      activeObjectByteLength: 0,
      legacyCandidatePaths: ["companies/acme.com/logo.png"],
      logoUrlReferenceCounts: new Map(),
    });
    assert.deepEqual(empty, [{ kind: "skip", reason: "active_object_empty" }]);
  });
});
