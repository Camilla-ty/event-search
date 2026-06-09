-- Sponsor Import Phase 2 pre-flight (read-only). Run: supabase db query --linked -f supabase/verify/sponsor_import_preflight.sql

-- P1: Duplicate (event_editions_id, company_id) summary
SELECT
  'P1_duplicates' AS check_id,
  COUNT(*)::bigint AS duplicate_groups,
  COALESCE(SUM(cnt - 1), 0)::bigint AS extra_rows_beyond_unique
FROM (
  SELECT event_editions_id, company_id, COUNT(*) AS cnt
  FROM public.event_sponsors
  GROUP BY event_editions_id, company_id
  HAVING COUNT(*) > 1
) d;

-- P1 detail (expect 0 rows)
SELECT 'P1_detail' AS section, event_editions_id, company_id, COUNT(*) AS row_count
FROM public.event_sponsors
GROUP BY event_editions_id, company_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC;

-- P2: NULL FK columns
SELECT 'P2_null_event_editions_id' AS check_id, COUNT(*)::bigint AS n
FROM public.event_sponsors WHERE event_editions_id IS NULL
UNION ALL
SELECT 'P2_null_company_id', COUNT(*)::bigint
FROM public.event_sponsors WHERE company_id IS NULL;

-- Baseline row count
SELECT 'event_sponsors_total' AS label, COUNT(*)::bigint AS n FROM public.event_sponsors;

-- P3/P4: dependency tables
SELECT 'profiles' AS tbl, COUNT(*)::bigint AS n FROM public.profiles
UNION ALL SELECT 'event_editions', COUNT(*)::bigint FROM public.event_editions
UNION ALL SELECT 'companies', COUNT(*)::bigint FROM public.companies;

-- Column nullability
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_sponsors'
ORDER BY ordinal_position;

-- Existing constraints
SELECT con.conname AS constraint_name, con.contype AS type,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public' AND rel.relname = 'event_sponsors'
ORDER BY con.conname;

-- P5: RLS
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'event_sponsors';

SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'public.event_sponsors'::regclass
ORDER BY polname;

-- Grants
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'event_sponsors'
ORDER BY grantee, privilege_type;

-- Import tables should not exist yet
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'sponsor_import_%'
ORDER BY table_name;
