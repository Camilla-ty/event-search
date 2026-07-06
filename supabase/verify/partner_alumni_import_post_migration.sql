-- Partner Alumni Import v1 post-migration verification (V1–V10).
-- Run after applying 20260713120000_partner_alumni_import_v1.sql:
--   supabase db query --linked -f supabase/verify/partner_alumni_import_post_migration.sql
--
-- Rollback notes (§ end of file): only safe before production import data exists.

-- =============================================================================
-- V1: Three import tables exist
-- =============================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'partner_alumni_import_batches',
    'partner_alumni_import_rows',
    'partner_alumni_import_action_logs'
  )
ORDER BY table_name;

-- =============================================================================
-- V2: Partial unique index (one active batch per version)
-- =============================================================================

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'partner_alumni_import_batches'
  AND indexname = 'pai_batches_one_active_per_version';

-- =============================================================================
-- V3: LD-3 match_method enum values
-- =============================================================================

SELECT e.enumlabel
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname = 'partner_alumni_import_match_method'
ORDER BY e.enumsortorder;
-- Expect: domain, alias, exact_name, manual, create_new

-- =============================================================================
-- V4: LD-6 create-new acknowledgment columns on batches
-- =============================================================================

SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partner_alumni_import_batches'
  AND column_name IN (
    'create_new_acknowledged_at',
    'create_new_acknowledged_count',
    'create_new_acknowledged_by',
    'review_acknowledged_at',
    'imported_at'
  )
ORDER BY column_name;

-- =============================================================================
-- V5: Row FK targets (version members, companies)
-- =============================================================================

SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'partner_alumni_import_rows'
  AND con.contype = 'f'
ORDER BY con.conname;

-- =============================================================================
-- V6: RLS enabled on import tables
-- =============================================================================

SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'partner_alumni_import_%'
ORDER BY c.relname;

-- V6b: No policies on import tables (expect 0 rows)
SELECT c.relname AS table_name, p.polname
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'partner_alumni_import_%'
ORDER BY c.relname, p.polname;

-- V6c: Grants — anon/authenticated should have none on import tables
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'partner_alumni_import_%'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

-- =============================================================================
-- V7: Storage bucket partner-alumni-imports (private)
-- =============================================================================

SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'partner-alumni-imports';

-- =============================================================================
-- V8: create_new_acknowledged action type in enum
-- =============================================================================

SELECT e.enumlabel
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname = 'partner_alumni_import_action_type'
  AND e.enumlabel IN ('create_new_acknowledged', 'import_completed', 'materialize_members_chunk')
ORDER BY e.enumlabel;

-- =============================================================================
-- V9: Version FK uses RESTRICT (batch blocked if version deleted mid-flight)
-- =============================================================================

SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'partner_alumni_import_batches'
  AND con.contype = 'f'
  AND pg_get_constraintdef(con.oid) LIKE '%event_partner_alumni_version%';

-- =============================================================================
-- V10: Sponsor import + event_sponsors untouched (row counts only)
-- =============================================================================

SELECT COUNT(*)::bigint AS event_sponsors_total FROM public.event_sponsors;

SELECT COUNT(*)::int AS sponsor_import_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'sponsor_import_%';

-- =============================================================================
-- Manual smoke tests (service_role; not automated here):
-- V11: Insert batch → row → action log → discard
-- V12: Anon SELECT on partner_alumni_import_batches → permission denied
-- V13: Two active batches same version → unique violation on partial index
-- V14: Delete version referenced by batch → RESTRICT violation
-- =============================================================================

-- =============================================================================
-- Rollback considerations (manual; no down migration shipped)
-- =============================================================================
-- Safe ONLY when no production Partner Alumni import batches exist yet.
--
-- 1. DROP TABLE public.partner_alumni_import_action_logs;
-- 2. DROP TABLE public.partner_alumni_import_rows;
-- 3. DROP TABLE public.partner_alumni_import_batches;
-- 4. DROP TYPE public.partner_alumni_import_action_type;
-- 5. DROP TYPE public.partner_alumni_import_source_file_format;
-- 6. DROP TYPE public.partner_alumni_import_intended_member_action;
-- 7. DROP TYPE public.partner_alumni_import_duplicate_resolution;
-- 8. DROP TYPE public.partner_alumni_import_duplicate_role;
-- 9. DROP TYPE public.partner_alumni_import_decision_source;
-- 10. DROP TYPE public.partner_alumni_import_decision_type;
-- 11. DROP TYPE public.partner_alumni_import_conflict_type;
-- 12. DROP TYPE public.partner_alumni_import_match_confidence;
-- 13. DROP TYPE public.partner_alumni_import_match_method;
-- 14. DROP TYPE public.partner_alumni_import_row_status;
-- 15. DROP TYPE public.partner_alumni_import_processing_phase;
-- 16. DROP TYPE public.partner_alumni_import_batch_status;
-- 17. DELETE FROM storage.objects WHERE bucket_id = 'partner-alumni-imports';
-- 18. DELETE FROM storage.buckets WHERE id = 'partner-alumni-imports';
--
-- Does NOT affect sponsor_import_* tables, event_sponsors, or Partner Alumni versions.
