import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const MIGRATION =
  "supabase/migrations/20260801120000_company_event_brand_public_profile_approved_at.sql";

describe("companies event_brand_public_profile_approved_at migration (ADR-005 EB0)", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("adds nullable timestamptz on companies", () => {
    assert.match(
      sql,
      /ADD COLUMN IF NOT EXISTS event_brand_public_profile_approved_at timestamptz/,
    );
    assert.doesNotMatch(
      sql,
      /event_brand_public_profile_approved_at timestamptz NOT NULL/,
    );
  });

  it("documents ADR-005 Admin-only semantics and no auto-approve", () => {
    assert.match(sql, /COMMENT ON COLUMN public\.companies\.event_brand_public_profile_approved_at/);
    assert.match(sql, /ADR-005/);
    assert.match(sql, /Admin-managed only/);
    assert.doesNotMatch(sql, /SET\s+event_brand_public_profile_approved_at\s*=/i);
  });
});
