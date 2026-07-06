-- Partner Alumni v2 (PA1′) post-migration verification (V1–V8).
-- Run after applying 20260711120000_partner_alumni_v2_versions.sql:
--   supabase db query --linked -f supabase/verify/partner_alumni_v2_post_migration.sql

-- V1: Three v2 tables exist; draft and snapshot tables removed
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'event_partner_alumni',
    'event_partner_alumni_versions',
    'event_partner_alumni_version_companies'
  )
ORDER BY table_name;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'event_partner_alumni_companies',
    'event_partner_alumni_snapshots',
    'event_partner_alumni_snapshot_companies'
  )
ORDER BY table_name;

-- V2: Program pointer columns — current_version_id present; v1 columns removed
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_partner_alumni'
  AND column_name IN (
    'current_version_id',
    'latest_snapshot_id',
    'recognition_label',
    'primary_source_url'
  )
ORDER BY column_name;

-- V3: Version header columns (v2)
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_partner_alumni_versions'
  AND column_name IN (
    'version_label',
    'recognition_label',
    'primary_source_url',
    'source_checked_at',
    'created_at',
    'updated_at',
    'verified_at'
  )
ORDER BY column_name;

-- V4: Version member columns and FK column name
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_partner_alumni_version_companies'
  AND column_name IN (
    'event_partner_alumni_version_id',
    'event_partner_alumni_snapshot_id',
    'company_id',
    'display_order',
    'created_at',
    'updated_at'
  )
ORDER BY column_name;

-- V5: FK delete rules — RESTRICT; short pa_* constraint names
SELECT
  con.conname,
  rel.relname AS table_name,
  rc.delete_rule
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = con.conname
 AND rc.constraint_schema = nsp.nspname
WHERE nsp.nspname = 'public'
  AND rel.relname IN (
    'event_partner_alumni',
    'event_partner_alumni_versions',
    'event_partner_alumni_version_companies'
  )
  AND con.contype = 'f'
ORDER BY rel.relname, con.conname;

-- V5b: Expected FK constraint names (expect 4 rows)
SELECT con.conname, rel.relname AS table_name
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND con.conname IN (
    'pa_program_current_version_fkey',
    'pa_versions_program_fkey',
    'pa_vc_version_fkey',
    'pa_vc_company_fkey'
  )
ORDER BY rel.relname, con.conname;

-- V6: UNIQUE indexes — one program per series; one company per version
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'event_partner_alumni_series_unique',
    'pa_vc_version_company_uq'
  )
ORDER BY tablename, indexname;

-- V6b: display_order CHECK on version members (short name)
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'event_partner_alumni_version_companies'
  AND con.conname = 'pa_vc_display_order_chk';

-- V7: RLS enabled; no anon/authenticated policies on Partner Alumni tables
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'event_partner_alumni',
    'event_partner_alumni_versions',
    'event_partner_alumni_version_companies'
  )
ORDER BY c.relname;

SELECT c.relname AS table_name, p.polname
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'event_partner_alumni',
    'event_partner_alumni_versions',
    'event_partner_alumni_version_companies'
  )
ORDER BY c.relname, p.polname;

-- V7b: Grants — anon/authenticated should have none on Partner Alumni tables
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'event_partner_alumni',
    'event_partner_alumni_versions',
    'event_partner_alumni_version_companies'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- V8: Indexes — current_version lookup and member ordering (short pa_* names)
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'event_partner_alumni_series_unique',
    'pa_program_current_version_idx',
    'pa_versions_program_created_idx',
    'pa_vc_version_company_uq',
    'pa_vc_version_order_idx',
    'pa_vc_company_idx'
  )
ORDER BY tablename, indexname;

-- V9: event_sponsors unchanged (sanity row count)
SELECT COUNT(*)::bigint AS event_sponsors_total FROM public.event_sponsors;

-- -----------------------------------------------------------------------------
-- Manual smoke tests (run separately; not automated here):
-- M1: SET ROLE anon; SELECT * FROM event_partner_alumni_versions LIMIT 1; → permission denied
-- M2: SET ROLE anon; SELECT * FROM event_partner_alumni_version_companies LIMIT 1; → permission denied
-- M3: service_role reads program.current_version_id → version + members for public route
-- M4: INSERT duplicate (version_id, company_id) → unique violation
