-- Company merge Phase 2 post-migration verification.
-- Run after applying 20260625120000_company_merge_phase2.sql:
--   supabase db query --linked -f supabase/verify/company_merge_phase2_post_migration.sql

-- V1: company_slug_redirects table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'company_slug_redirects';

-- V2: merge_companies signature includes p_resolutions jsonb
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'merge_companies';

-- V3: Phase 1 merge_companies(uuid, uuid, uuid, text) dropped
SELECT COUNT(*)::bigint AS legacy_merge_companies_overload_count
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'merge_companies'
  AND pg_get_function_identity_arguments(p.oid) = 'p_canonical_company_id uuid, p_duplicate_company_id uuid, p_performed_by uuid, p_notes text';

-- V4: Preview returns schema_version 2 (requires two valid active company ids — manual substitute)
-- SELECT (public.company_merge_preview('<canonical>', '<duplicate>') -> 'preview_snapshot' ->> 'schema_version') AS preview_schema_version;

-- V5: RLS on company_slug_redirects
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'company_slug_redirects';

-- V6: No anon/authenticated grants on company_slug_redirects
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'company_slug_redirects'
  AND grantee IN ('anon', 'authenticated');

-- V7: Helper RPCs present
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('company_merge_preview', 'merge_companies', '_company_merge_build_preview')
ORDER BY p.proname;

-- -----------------------------------------------------------------------------
-- Manual smoke tests (service_role; not on CKMA/ČKMA):
-- P1: Preview pair with overlap → required_resolutions populated, schema_version = 2
-- P2: merge_companies without conflict resolutions → merge_missing_resolution
-- P3: merge_companies with keep_canonical on all conflicts → success + execution_snapshot.phase = 2
-- P4: Zero-dependency merge with {} resolutions → still succeeds (Phase 1 regression)
-- P5: Loser slug present in company_slug_redirects after merge with different slugs
