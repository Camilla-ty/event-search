-- Partner Alumni merge repoint verification (PA5)
-- Run after applying 20260712120000_company_merge_partner_alumni.sql:
--   supabase db query --linked -f supabase/verify/partner_alumni_merge_post_migration.sql

-- F1: merge helper exists
SELECT EXISTS (
  SELECT 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = '_company_merge_process_partner_alumni'
) AS partner_alumni_merge_fn_exists;

-- F2: preview impact includes partner alumni counter (function body smoke)
SELECT
  position(
    'partner_alumni_version_members_to_repoint' IN pg_get_functiondef(
      'public._company_merge_build_preview(uuid, uuid)'::regprocedure
    )
  ) > 0 AS preview_includes_partner_alumni_impact;

-- F3: merge execution includes partner alumni actions (function body smoke)
SELECT
  position(
    'partner_alumni_version_members_repointed' IN pg_get_functiondef(
      'public.merge_companies(uuid, uuid, uuid, jsonb, text)'::regprocedure
    )
  ) > 0 AS merge_includes_partner_alumni_actions;

-- F4: event_sponsors unchanged (no partner alumni table references in sponsor count path — app-level)
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'event_sponsors'
) AS event_sponsors_table_exists;

-- Manual QA (admin UI + staging data):
-- M1: Create version, copy current, bulk upload 400+ rows, set current
-- M2: Public tab visible when current version has members; hidden when no current
-- M3: Merge duplicate company with PA membership — version member repoints; same-version dedupe keeps lower display_order
-- M4: Sponsor import + edition sponsor count unchanged after PA merge
