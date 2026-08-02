-- Post-migration checks for Partner Alumni public reads (ARC-001 Phase 5).

SELECT c.relname AS view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN (
    'event_partner_alumni_public_versions',
    'event_partner_alumni_public_members'
  )
ORDER BY c.relname;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'event_partner_alumni_public_versions',
    'event_partner_alumni_public_members'
  )
ORDER BY table_name, ordinal_position;

-- Must not expose admin/version-management columns on the public views.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'event_partner_alumni_public_versions',
    'event_partner_alumni_public_members'
  )
  AND column_name IN (
    'current_version_id',
    'event_partner_alumni_id',
    'event_partner_alumni_version_id',
    'created_at',
    'updated_at',
    'verified_at',
    'aliases'
  );

-- Underlying tables remain closed to anon/authenticated.
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'event_partner_alumni',
    'event_partner_alumni_versions',
    'event_partner_alumni_version_companies'
  )
  AND grantee IN ('anon', 'authenticated');

-- Public views: SELECT only.
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'event_partner_alumni_public_versions',
    'event_partner_alumni_public_members'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- Members must only reference the program's current_version_id.
SELECT count(*)::integer AS leaked_non_current_members
FROM public.event_partner_alumni_public_members pm
INNER JOIN public.event_partner_alumni epa
  ON epa.event_series_id = pm.event_series_id
INNER JOIN public.event_partner_alumni_version_companies raw
  ON raw.id = pm.member_id
WHERE epa.current_version_id IS NULL
   OR raw.event_partner_alumni_version_id IS DISTINCT FROM epa.current_version_id;
