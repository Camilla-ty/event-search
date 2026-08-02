import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  buildEventBrandPublicDestinationIndexFromRows,
  buildPublicCompanyRoleHref,
  withPublicCompanyRoleHref,
  type EventBrandPublicDestinationIndex,
} from "@/src/lib/companies/eventBrandPublicDestinationIndex";

const sourcePath = join(
  process.cwd(),
  "src/lib/companies/eventBrandPublicDestinationIndex.ts",
);
const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260802140000_event_brand_public_destinations.sql",
);

const SFF_ID = "f85bff6d-f25a-40c5-839f-4a395fbb3d37";
const SFF_SLUG = "singapore-fintech-festival";
const SFF_APPROVED_AT = "2026-08-01T11:19:34.191394+00";
const SFF_SERIES_ID = "78232c5b-7ef2-4cda-a23a-941387e1a9c1";

describe("eventBrandPublicDestinationIndex wiring (ARC-001 Phase 4)", () => {
  it("destination-index helpers no longer use createAdminClient", () => {
    const source = readFileSync(sourcePath, "utf8");
    assert.match(source, /createClient/);
    assert.match(source, /event_brand_public_destinations/);
    assert.match(source, /buildEventBrandPublicDestinationIndexFromRows/);
    assert.doesNotMatch(source, /createAdminClient/);
    assert.doesNotMatch(source, /from "@\/src\/lib\/supabase\/admin"/);
    assert.doesNotMatch(source, /fetchAllByIdInBatches/);
  });

  it("migration exposes only destination routing fields with SELECT grants", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /event_brand_public_destinations/);
    assert.match(sql, /security_invoker\s*=\s*false/i);
    assert.match(sql, /restricted_at IS NULL/);
    assert.match(sql, /merged_into_company_id IS NULL/);
    assert.match(
      sql,
      /REVOKE ALL ON public\.event_brand_public_destinations FROM PUBLIC, anon, authenticated/,
    );
    assert.match(
      sql,
      /GRANT SELECT ON public\.event_brand_public_destinations TO anon, authenticated/,
    );

    const selectBody = sql.match(/AS\s*\nSELECT([\s\S]*?)FROM public\.companies/)?.[1] ?? "";
    assert.match(selectBody, /company_id/);
    assert.match(selectBody, /approved_at/);
    assert.match(selectBody, /series_id/);
    assert.doesNotMatch(selectBody, /\bdomain\b/);
    assert.doesNotMatch(selectBody, /\bwebsite\b/);
    assert.doesNotMatch(selectBody, /\blogo_url\b/);
    assert.doesNotMatch(selectBody, /\baliases\b/);
  });
});

describe("buildEventBrandPublicDestinationIndexFromRows", () => {
  it("returns approved public destinations with same-brand Series", () => {
    const index = buildEventBrandPublicDestinationIndexFromRows([
      {
        company_id: SFF_ID,
        approved_at: SFF_APPROVED_AT,
        series_id: SFF_SERIES_ID,
        series_slug: SFF_SLUG,
        series_name: "Singapore Fintech Festival",
        series_lifecycle_status: "active",
      },
    ]);

    assert.equal(index.size, 1);
    const entry = index.get(SFF_ID);
    assert.ok(entry);
    assert.equal(entry.approvedAt, SFF_APPROVED_AT);
    assert.deepEqual(entry.series, {
      id: SFF_SERIES_ID,
      slug: SFF_SLUG,
      name: "Singapore Fintech Festival",
      lifecycle_status: "active",
    });
  });

  it("keeps approved companies with null Series (caller falls back to sponsor path)", () => {
    const index = buildEventBrandPublicDestinationIndexFromRows([
      {
        company_id: SFF_ID,
        approved_at: SFF_APPROVED_AT,
        series_id: null,
        series_slug: null,
        series_name: null,
        series_lifecycle_status: null,
      },
    ]);

    assert.equal(index.get(SFF_ID)?.series, null);
  });

  it("skips rows without a usable company id or approval timestamp", () => {
    const index = buildEventBrandPublicDestinationIndexFromRows([
      {
        company_id: "  ",
        approved_at: SFF_APPROVED_AT,
        series_id: SFF_SERIES_ID,
      },
      {
        company_id: SFF_ID,
        approved_at: "   ",
        series_id: SFF_SERIES_ID,
      },
      {
        company_id: null,
        approved_at: SFF_APPROVED_AT,
      },
    ]);

    assert.equal(index.size, 0);
  });
});

describe("destination index output shape for callers", () => {
  function indexFromRows(): EventBrandPublicDestinationIndex {
    return buildEventBrandPublicDestinationIndexFromRows([
      {
        company_id: SFF_ID,
        approved_at: SFF_APPROVED_AT,
        series_id: SFF_SERIES_ID,
        series_slug: SFF_SLUG,
        series_name: "Singapore Fintech Festival",
        series_lifecycle_status: "active",
      },
    ]);
  }

  it("preserves same-brand company → event series hub links", () => {
    const href = buildPublicCompanyRoleHref(
      { id: SFF_ID, slug: SFF_SLUG, restricted_at: null },
      indexFromRows(),
    );
    assert.equal(href, "/events/series/singapore-fintech-festival");
  });

  it("excludes restricted companies from linkable output", () => {
    const href = buildPublicCompanyRoleHref(
      {
        id: SFF_ID,
        slug: SFF_SLUG,
        restricted_at: "2026-07-11T00:00:00.000Z",
      },
      indexFromRows(),
    );
    assert.equal(href, null);
  });

  it("withPublicCompanyRoleHref keeps the existing attached shape", () => {
    const company = withPublicCompanyRoleHref(
      {
        id: SFF_ID,
        slug: SFF_SLUG,
        restricted_at: null,
      },
      indexFromRows(),
    );

    assert.equal(company.id, SFF_ID);
    assert.equal(company.slug, SFF_SLUG);
    assert.equal(company.restricted_at, null);
    assert.equal(company.public_href, "/events/series/singapore-fintech-festival");
    assert.deepEqual(Object.keys(company).sort(), [
      "id",
      "public_href",
      "restricted_at",
      "slug",
    ]);
  });
});
