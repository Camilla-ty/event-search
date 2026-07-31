import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260731120000_event_series_company_profile_id.sql",
);

describe("event_series company_profile_id migration (ADR-004 SB0)", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("adds nullable company_profile_id on event_series", () => {
    assert.match(sql, /ADD COLUMN IF NOT EXISTS company_profile_id uuid/);
    assert.match(sql, /COMMENT ON COLUMN public\.event_series\.company_profile_id/);
    assert.doesNotMatch(sql, /company_profile_id uuid NOT NULL/);
    assert.doesNotMatch(sql, /verified_at/);
    assert.doesNotMatch(sql, /proposed/);
  });

  it("references companies with ON DELETE RESTRICT", () => {
    assert.match(sql, /event_series_company_profile_id_fkey/);
    assert.match(sql, /REFERENCES public\.companies \(id\)/);
    assert.match(sql, /ON DELETE RESTRICT/);
    assert.doesNotMatch(sql, /ON DELETE SET NULL/);
    assert.doesNotMatch(sql, /ON DELETE CASCADE/);
  });

  it("enforces reverse 1:1 uniqueness on company_profile_id", () => {
    assert.match(sql, /event_series_company_profile_id_key/);
    assert.match(sql, /UNIQUE \(company_profile_id\)/);
  });

  it("does not backfill or auto-link rows", () => {
    assert.doesNotMatch(sql, /UPDATE\s+public\.event_series/i);
    assert.doesNotMatch(sql, /SET\s+company_profile_id\s*=/i);
    assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.event_series/i);
  });
});
