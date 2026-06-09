-- Sponsor Import Phase 2 post-migration verification (V1–V8).
-- Run after applying 20260610120000_sponsor_import_phase2.sql:
--   supabase db query --linked -f supabase/verify/sponsor_import_post_migration.sql

-- V1: Four import tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'sponsor_import_batches',
    'sponsor_import_rows',
    'sponsor_import_draft_links',
    'sponsor_import_admin_action_logs'
  )
ORDER BY table_name;

-- V2: Partial unique index (one active batch per edition)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'sponsor_import_batches'
  AND indexname = 'sponsor_import_batches_one_active_per_edition';

-- V3: event_sponsors UNIQUE + NOT NULL
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'event_sponsors'
  AND con.conname = 'event_sponsors_event_editions_id_company_id_unique';

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_sponsors'
  AND column_name IN ('event_editions_id', 'company_id')
ORDER BY column_name;

-- V4: RLS enabled on import tables
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'sponsor_import_%'
ORDER BY c.relname;

-- V4b: No policies on import tables (expect 0 rows)
SELECT c.relname AS table_name, p.polname
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'sponsor_import_%'
ORDER BY c.relname, p.polname;

-- V4c: Grants — anon/authenticated should have none on import tables
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'sponsor_import_%'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

-- V8 helper: existing event_sponsors row count unchanged
SELECT COUNT(*)::bigint AS event_sponsors_total FROM public.event_sponsors;

-- -----------------------------------------------------------------------------
-- Manual smoke tests (run separately with service_role; not automated here):
-- V5: Insert batch → row → draft link → discard
-- V6: Anon SELECT on sponsor_import_batches → permission denied
-- V7: Duplicate (event_editions_id, company_id) INSERT → unique violation
-- V8: Two active batches same edition → unique violation on partial index
