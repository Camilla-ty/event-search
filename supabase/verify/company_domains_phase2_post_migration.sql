-- Company domain matching Phase 2 post-migration verification.
-- Run after applying 20260630120000_company_domains.sql:
--   supabase db query --linked -f supabase/verify/company_domains_phase2_post_migration.sql

-- V1: company_domains table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'company_domains';

-- V2: Expected columns
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'company_domains'
  AND column_name IN ('id', 'company_id', 'domain', 'is_primary', 'created_at')
ORDER BY column_name;

-- V3: Indexes and constraints
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'company_domains'
ORDER BY indexname;

-- V4: RLS enabled
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'company_domains';

-- V5: No policies (expect 0 rows)
SELECT c.relname AS table_name, p.polname
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'company_domains';

-- V6: Grants — anon/authenticated should have none
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'company_domains'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee;

-- -----------------------------------------------------------------------------
-- Data verification report
-- -----------------------------------------------------------------------------

-- R1: Active companies with non-null domain (backfill source count)
SELECT count(*)::bigint AS active_companies_with_domain
FROM public.companies
WHERE status = 'active'::public.company_status
  AND domain IS NOT NULL
  AND trim(domain) <> '';

-- R2: Backfilled company_domains rows (all should be primary in Phase 2)
SELECT
  count(*)::bigint AS company_domains_total,
  count(*) FILTER (WHERE is_primary = true)::bigint AS company_domains_primary
FROM public.company_domains;

-- R3: Counts should match
SELECT
  (SELECT count(*) FROM public.companies
   WHERE status = 'active'::public.company_status
     AND domain IS NOT NULL AND trim(domain) <> '') AS source_count,
  (SELECT count(*) FROM public.company_domains WHERE is_primary = true) AS backfill_count,
  (SELECT count(*) FROM public.companies
   WHERE status = 'active'::public.company_status
     AND domain IS NOT NULL AND trim(domain) <> '')
  =
  (SELECT count(*) FROM public.company_domains WHERE is_primary = true) AS counts_match;

-- R4: Duplicate domains in company_domains (expect 0 rows)
SELECT lower(domain) AS domain_key, count(*)::bigint AS row_count
FROM public.company_domains
GROUP BY 1
HAVING count(*) > 1
ORDER BY row_count DESC, domain_key;

-- R5: Active companies with domain but missing primary company_domains row (expect 0 rows)
SELECT c.id, c.name, c.domain
FROM public.companies c
LEFT JOIN public.company_domains cd
  ON cd.company_id = c.id AND cd.is_primary = true
WHERE c.status = 'active'::public.company_status
  AND c.domain IS NOT NULL
  AND trim(c.domain) <> ''
  AND cd.id IS NULL
ORDER BY c.name
LIMIT 50;

-- R6: Pre-existing duplicate domains among active companies (informational; should be 0)
SELECT lower(trim(domain)) AS domain_key, count(*)::bigint AS company_count
FROM public.companies
WHERE status = 'active'::public.company_status
  AND domain IS NOT NULL
  AND trim(domain) <> ''
GROUP BY 1
HAVING count(*) > 1
ORDER BY company_count DESC, domain_key;
