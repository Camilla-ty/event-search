-- Post-migration checks for event_edition_sponsor_public_aggregates.
-- Expect: views exist, granted to anon/authenticated, no company identity columns.

SELECT c.relname AS view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN (
    'event_edition_sponsor_counts',
    'event_edition_sponsor_tier_stats'
  )
ORDER BY c.relname;

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'event_edition_sponsor_counts',
    'event_edition_sponsor_tier_stats'
  )
ORDER BY table_name, ordinal_position;

-- Must not expose company identity columns on either view.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'event_edition_sponsor_counts',
    'event_edition_sponsor_tier_stats'
  )
  AND column_name IN (
    'company_id',
    'name',
    'slug',
    'domain',
    'website',
    'logo_url'
  );

-- Expect SELECT only for anon/authenticated (no INSERT/UPDATE/DELETE).
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'event_edition_sponsor_counts',
    'event_edition_sponsor_tier_stats'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
