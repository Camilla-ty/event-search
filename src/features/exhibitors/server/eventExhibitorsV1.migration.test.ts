import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260725130000_event_exhibitors_v1.sql",
);

describe("event_exhibitors v1 migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("creates event_exhibitors with uniqueness and sponsor-like tier columns", () => {
    assert.match(sql, /CREATE TABLE public\.event_exhibitors/);
    assert.match(sql, /event_exhibitors_edition_company_unique/);
    assert.match(sql, /UNIQUE INDEX event_exhibitors_edition_company_unique/);
    assert.match(sql, /tier_rank integer NULL/);
    assert.match(sql, /tier_label text NULL/);
    assert.match(sql, /display_order integer NULL/);
    assert.match(sql, /event_exhibitors_edition_tier_order_idx/);
    assert.match(sql, /ON DELETE RESTRICT/);
    assert.doesNotMatch(sql, /booth_number/);
    assert.doesNotMatch(sql, /\bhall text\b/);
  });

  it("enables public SELECT RLS without client writes and without tier gates on exhibitors", () => {
    const tableSection = sql.slice(
      sql.indexOf("CREATE TABLE public.event_exhibitors"),
      sql.indexOf("-- Phase D — company merge"),
    );
    assert.match(tableSection, /ALTER TABLE public\.event_exhibitors ENABLE ROW LEVEL SECURITY/);
    assert.match(tableSection, /event_exhibitors_select_anon_all/);
    assert.match(tableSection, /event_exhibitors_select_authenticated_all/);
    assert.match(
      tableSection,
      /GRANT SELECT ON TABLE public\.event_exhibitors TO anon, authenticated/,
    );
    assert.doesNotMatch(tableSection, /tier_rank = 1/);
    assert.doesNotMatch(tableSection, /GRANT INSERT ON TABLE public\.event_exhibitors/);
    assert.doesNotMatch(tableSection, /GRANT UPDATE ON TABLE public\.event_exhibitors/);
    assert.doesNotMatch(tableSection, /GRANT DELETE ON TABLE public\.event_exhibitors/);
  });

  it("extends company merge with Sponsor-style exhibitor tier conflicts", () => {
    assert.match(sql, /_company_merge_exhibitor_strategy/);
    assert.match(sql, /_company_merge_process_exhibitors/);
    assert.match(sql, /keep_duplicate_tier/);
    assert.match(sql, /exhibitor_conflict_keep_canonical/);
    assert.match(sql, /exhibitor_conflict_keep_duplicate_tier/);
    assert.match(sql, /event_exhibitors_to_repoint/);
    assert.match(sql, /FROM public\.event_exhibitors ex/);
    assert.match(
      sql,
      /v_exhibitor_result := public\._company_merge_process_exhibitors/,
    );
    assert.doesNotMatch(sql, /booth_number_conflict/);
    assert.doesNotMatch(sql, /hall_conflict/);
    assert.match(sql, /DROP FUNCTION IF EXISTS public\._company_merge_exhibitor_pick_text/);
    assert.match(sql, /DROP FUNCTION IF EXISTS public\._company_merge_exhibitor_field_strategy/);
    assert.match(sql, /DROP FUNCTION IF EXISTS public\._company_merge_exhibitor_texts_conflict/);
    assert.doesNotMatch(
      sql,
      /CREATE OR REPLACE FUNCTION public\._company_merge_exhibitor_pick_text/,
    );
    assert.doesNotMatch(
      sql,
      /CREATE OR REPLACE FUNCTION public\._company_merge_exhibitor_field_strategy/,
    );
    assert.doesNotMatch(
      sql,
      /CREATE OR REPLACE FUNCTION public\._company_merge_exhibitor_texts_conflict/,
    );
  });

  it("treats exhibitor links as merge dependencies", () => {
    const deps = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public._company_merge_duplicate_has_dependencies"),
      sql.indexOf("CREATE OR REPLACE FUNCTION public._company_merge_validate_resolutions"),
    );
    assert.match(deps, /FROM public\.event_exhibitors ex/);
  });
});
