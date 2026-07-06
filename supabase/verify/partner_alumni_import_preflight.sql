-- Partner Alumni Import v1 pre-migration verification (P1–P4).
-- Run before applying 20260713120000_partner_alumni_import_v1.sql:
--   supabase db query --linked -f supabase/verify/partner_alumni_import_preflight.sql
--
-- Block migration if any check fails.

-- P1: Partner Alumni version model present
SELECT
  to_regclass('public.event_partner_alumni_versions') IS NOT NULL AS p1_versions_table,
  to_regclass('public.event_partner_alumni_version_companies') IS NOT NULL AS p1_version_members_table;

-- P2: Core FK targets present
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('event_series', 'profiles', 'companies')
ORDER BY table_name;

-- P3: Import tables must not already exist (avoid duplicate migration)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'partner_alumni_import_batches',
    'partner_alumni_import_rows',
    'partner_alumni_import_action_logs'
  )
ORDER BY table_name;
-- Expect 0 rows before first apply.

-- P4: Sponsor import tables unchanged (sanity — should exist from prior migrations)
SELECT COUNT(*)::int AS sponsor_import_batch_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'sponsor_import_batches';
