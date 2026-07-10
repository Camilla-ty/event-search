import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateReferencedLogoPaths } from "./collectReferencedLogoPaths";
import {
  resolveCatalogLogoStoragePath,
  type LogoSourceTable,
} from "./resolveCatalogLogoStoragePath";

const COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const SERIES_ID = "00000000-0000-4000-8000-000000000002";
const VENUE_ID = "00000000-0000-4000-8000-000000000003";
const SUPABASE_PUBLIC_BASE =
  "https://example.supabase.co/storage/v1/object/public/company-logos";

describe("resolveCatalogLogoStoragePath", () => {
  it("includes canonical bucket-relative company paths", () => {
    const result = resolveCatalogLogoStoragePath("companies", {
      id: COMPANY_ID,
      logo_url: `companies/${COMPANY_ID}/logo.png`,
    });
    assert.deepEqual(result, {
      kind: "include",
      path: `companies/${COMPANY_ID}/logo.png`,
    });
  });

  it("normalizes full Supabase public URLs to canonical paths", () => {
    const result = resolveCatalogLogoStoragePath("event_series", {
      id: SERIES_ID,
      logo_url: `${SUPABASE_PUBLIC_BASE}/event-series/${SERIES_ID}/logo.svg`,
    });
    assert.deepEqual(result, {
      kind: "include",
      path: `event-series/${SERIES_ID}/logo.svg`,
    });
  });

  it("skips external URLs", () => {
    const result = resolveCatalogLogoStoragePath("venues", {
      id: VENUE_ID,
      logo_url: "https://cdn.example.com/venue-logo.png",
    });
    assert.deepEqual(result, { kind: "skip", reason: "external_url" });
  });

  it("skips legacy domain-based company paths", () => {
    const result = resolveCatalogLogoStoragePath("companies", {
      id: COMPANY_ID,
      logo_url: "companies/acme.com/logo.png",
    });
    assert.deepEqual(result, { kind: "skip", reason: "invalid" });
  });

  it("skips paths whose entity id does not match the row id", () => {
    const result = resolveCatalogLogoStoragePath("companies", {
      id: COMPANY_ID,
      logo_url: "companies/00000000-0000-4000-8000-000000000099/logo.png",
    });
    assert.deepEqual(result, { kind: "skip", reason: "invalid" });
  });
});

describe("aggregateReferencedLogoPaths", () => {
  it("deduplicates paths and counts skipped rows", () => {
    const rows: Array<{ table: LogoSourceTable; row: { id: string; logo_url: string | null } }> = [
      {
        table: "companies",
        row: { id: COMPANY_ID, logo_url: `companies/${COMPANY_ID}/logo.png` },
      },
      {
        table: "companies",
        row: { id: COMPANY_ID, logo_url: `companies/${COMPANY_ID}/logo.png` },
      },
      {
        table: "venues",
        row: { id: VENUE_ID, logo_url: "https://example.com/external.png" },
      },
      {
        table: "event_series",
        row: { id: SERIES_ID, logo_url: "companies/acme.com/logo.png" },
      },
    ];

    const result = aggregateReferencedLogoPaths(rows);
    assert.equal(result.referenced_path_count, 1);
    assert.deepEqual(result.paths, [`companies/${COMPANY_ID}/logo.png`]);
    assert.equal(result.skipped_external_url_count, 1);
    assert.equal(result.skipped_invalid_count, 1);
  });
});
