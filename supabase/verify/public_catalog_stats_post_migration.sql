-- Post-migration checks for public_catalog_stats (ARC-001 Phase 3).

SELECT c.relname AS view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname = 'public_catalog_stats';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'public_catalog_stats'
ORDER BY ordinal_position;

-- Must not expose identity columns.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'public_catalog_stats'
  AND column_name IN (
    'id',
    'company_id',
    'name',
    'slug',
    'domain',
    'website',
    'logo_url',
    'city_id'
  );

-- Expect SELECT only for anon/authenticated.
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'public_catalog_stats'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- Shape sanity: exactly one aggregate row.
SELECT count(*)::integer AS row_count
FROM public.public_catalog_stats;
