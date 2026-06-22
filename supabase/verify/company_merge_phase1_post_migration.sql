-- Company merge Phase 1 post-migration verification.
-- Run after applying 20260624120000_company_merge_phase1.sql:
--   supabase db query --linked -f supabase/verify/company_merge_phase1_post_migration.sql

-- V1: Enum types exist
SELECT typname
FROM pg_type
WHERE typnamespace = 'public'::regnamespace
  AND typname IN ('company_status', 'company_merge_status')
ORDER BY typname;

-- V2: companies merge columns
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
  AND column_name IN ('status', 'merged_into_company_id', 'merged_at', 'merged_by')
ORDER BY column_name;

-- V3: companies merge constraints
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'companies'
  AND con.conname IN ('companies_active_not_merged', 'companies_merged_requires_target')
ORDER BY con.conname;

-- V4: company_merges table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'company_merges';

-- V5: RLS enabled on company_merges
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'company_merges';

-- V5b: No policies on company_merges (expect 0 rows)
SELECT c.relname AS table_name, p.polname
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'company_merges';

-- V5c: Grants — anon/authenticated should have none on company_merges
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'company_merges'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee;

-- V6: RPCs exist
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('company_merge_preview', 'merge_companies')
ORDER BY p.proname;

-- V7: All existing companies default active
SELECT
  COUNT(*) FILTER (WHERE status = 'active'::public.company_status) AS active_count,
  COUNT(*) FILTER (WHERE status = 'merged'::public.company_status) AS merged_count,
  COUNT(*) AS total
FROM public.companies;

-- V8: No invalid merged rows
SELECT COUNT(*)::bigint AS invalid_merged_rows
FROM public.companies
WHERE status = 'merged'::public.company_status
  AND merged_into_company_id IS NULL;

-- -----------------------------------------------------------------------------
-- Manual smoke tests (service_role; not automated here):
-- P1: SELECT public.company_merge_preview('<canonical_uuid>', '<duplicate_uuid>');
-- P2: Same company → merge_same_company
-- P3: Execute on duplicate with sponsorships → merge_dependencies_not_repointed
-- P4: Execute on zero-dependency test duplicate only
-- P5: Anon SELECT on company_merges → permission denied
