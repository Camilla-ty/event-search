-- Post-migration verification for alias-domain search.
-- Run: supabase db query --linked -f supabase/verify/sponsor_discovery_company_domains_search_post_migration.sql

-- V1: Latest applied migration
SELECT 'V1_latest_migration' AS check_id, version, name
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 3;

-- V2: Helper function security
SELECT
  'V2_function_security' AS check_id,
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('__company_matches_verified_domain_search', 'sponsor_discovery_page')
ORDER BY p.proname;

-- V3: company_domains privileges for anon/authenticated
SELECT
  'V3_company_domains_privileges' AS check_id,
  has_table_privilege('anon', 'public.company_domains', 'SELECT') AS anon_select,
  has_table_privilege('authenticated', 'public.company_domains', 'SELECT') AS auth_select,
  has_table_privilege('service_role', 'public.company_domains', 'SELECT') AS service_role_select;

-- V4: Pick alias-only searchable fixture (non-primary domain, not on companies.domain)
WITH alias_only AS (
  SELECT
    c.id,
    c.name,
    c.slug,
    c.domain AS primary_domain,
    cd.domain AS alias_domain,
    c.restricted_at IS NOT NULL AS is_restricted,
    EXISTS (SELECT 1 FROM public.company_sponsor_stats css WHERE css.company_id = c.id) AS in_discovery
  FROM public.companies c
  INNER JOIN public.company_domains cd ON cd.company_id = c.id
  WHERE cd.is_primary = false
    AND c.status = 'active'
    AND coalesce(c.domain, '') <> cd.domain
    AND coalesce(c.website, '') NOT ILIKE '%' || cd.domain || '%'
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(c.aliases, '{}'::text[])) AS a(alias)
      WHERE a.alias ILIKE '%' || cd.domain || '%'
    )
)
SELECT 'V4_alias_only_fixture' AS check_id, *
FROM alias_only
WHERE in_discovery = true
  AND is_restricted = false
ORDER BY alias_domain
LIMIT 5;

-- V5: Restricted company with alias domain (for exclusion test)
SELECT
  'V5_restricted_fixture' AS check_id,
  c.id,
  c.name,
  cd.domain AS alias_domain,
  c.restricted_at
FROM public.companies c
INNER JOIN public.company_domains cd ON cd.company_id = c.id
WHERE c.restricted_at IS NOT NULL
  AND c.status = 'active'
  AND EXISTS (SELECT 1 FROM public.company_sponsor_stats css WHERE css.company_id = c.id)
LIMIT 3;
