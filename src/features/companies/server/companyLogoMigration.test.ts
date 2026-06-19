import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  auditRecordForPlan,
  auditRecordForSkip,
  contentTypeForLogoExtension,
  planCompanyLogoMigration,
} from "@/src/features/companies/server/companyLogoMigration";

const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";
const BASE_URL = "https://example.supabase.co/storage/v1/object/public/company-logos";

function buildPublicUrl(storagePath: string): string {
  return `${BASE_URL}/${storagePath}`;
}

describe("contentTypeForLogoExtension", () => {
  it("maps logo extensions to content types", () => {
    assert.equal(contentTypeForLogoExtension("png"), "image/png");
    assert.equal(contentTypeForLogoExtension("jpeg"), "image/jpeg");
    assert.equal(contentTypeForLogoExtension("webp"), "image/webp");
    assert.equal(contentTypeForLogoExtension("svg"), "image/svg+xml");
  });
});

describe("planCompanyLogoMigration", () => {
  it("plans migration from a legacy domain path", () => {
    const result = planCompanyLogoMigration(
      {
        id: COMPANY_ID,
        name: "Acme Corp",
        logo_url: `${BASE_URL}/companies/acme.com/logo.png`,
      },
      buildPublicUrl,
    );

    assert.equal(result.kind, "plan");
    if (result.kind !== "plan") return;

    assert.equal(result.plan.companyId, COMPANY_ID);
    assert.equal(result.plan.oldStoragePath, "companies/acme.com/logo.png");
    assert.equal(result.plan.newStoragePath, `companies/${COMPANY_ID}/logo.png`);
    assert.equal(
      result.plan.newPublicUrl,
      `${BASE_URL}/companies/${COMPANY_ID}/logo.png`,
    );
  });

  it("skips rows already on the companyId path", () => {
    const result = planCompanyLogoMigration(
      {
        id: COMPANY_ID,
        name: "Acme Corp",
        logo_url: `${BASE_URL}/companies/${COMPANY_ID}/logo.webp`,
      },
      buildPublicUrl,
    );

    assert.deepEqual(result, { kind: "skip", reason: "already_company_id_path" });
  });

  it("skips external logo URLs", () => {
    const result = planCompanyLogoMigration(
      {
        id: COMPANY_ID,
        name: "Acme Corp",
        logo_url: "https://cdn.example.com/logo.png",
      },
      buildPublicUrl,
    );

    assert.deepEqual(result, { kind: "skip", reason: "not_storage_url" });
  });

  it("skips missing logo URLs", () => {
    const result = planCompanyLogoMigration(
      {
        id: COMPANY_ID,
        name: "Acme Corp",
        logo_url: null,
      },
      buildPublicUrl,
    );

    assert.deepEqual(result, { kind: "skip", reason: "missing_logo_url" });
  });

  it("plans migration when storage path uses a different company id segment", () => {
    const otherCompanyId = "11111111-1111-1111-1111-111111111111";
    const result = planCompanyLogoMigration(
      {
        id: COMPANY_ID,
        name: "Acme Corp",
        logo_url: `${BASE_URL}/companies/${otherCompanyId}/logo.png`,
      },
      buildPublicUrl,
    );

    assert.equal(result.kind, "plan");
    if (result.kind !== "plan") return;
    assert.equal(result.plan.newStoragePath, `companies/${COMPANY_ID}/logo.png`);
  });
});

describe("audit records", () => {
  it("writes dry-run audit entries", () => {
    const planResult = planCompanyLogoMigration(
      {
        id: COMPANY_ID,
        name: "Acme Corp",
        logo_url: `${BASE_URL}/companies/acme.com/logo.png`,
      },
      buildPublicUrl,
    );
    assert.equal(planResult.kind, "plan");
    if (planResult.kind !== "plan") return;

    const record = auditRecordForPlan({
      plan: planResult.plan,
      status: "dry_run_planned",
      migratedAt: "2026-06-11T00:00:00.000Z",
    });

    assert.equal(record.status, "dry_run_planned");
    assert.equal(record.oldLogoUrl, planResult.plan.oldLogoUrl);
    assert.equal(record.newLogoUrl, planResult.plan.newPublicUrl);
  });

  it("writes skip audit entries", () => {
    const record = auditRecordForSkip({
      row: {
        id: COMPANY_ID,
        name: "Acme Corp",
        logo_url: `${BASE_URL}/companies/${COMPANY_ID}/logo.png`,
      },
      reason: "already_company_id_path",
      migratedAt: "2026-06-11T00:00:00.000Z",
    });

    assert.equal(record.status, "skipped");
    assert.equal(record.skipReason, "already_company_id_path");
  });
});
