-- Post-migration checks for event_brand_public_destinations (ARC-001 Phase 4).

SELECT c.relname AS view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname = 'event_brand_public_destinations';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_brand_public_destinations'
ORDER BY ordinal_position;

-- Must not expose extra identity/private columns.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_brand_public_destinations'
  AND column_name IN (
    'domain',
    'website',
    'logo_url',
    'aliases',
    'restricted_at',
    'merged_into_company_id',
    'status'
  );

SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'event_brand_public_destinations'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- Restricted/merged/inactive approved companies must not appear.
SELECT count(*)::integer AS leaked_unavailable
FROM public.event_brand_public_destinations d
INNER JOIN public.companies c ON c.id = d.company_id
WHERE c.restricted_at IS NOT NULL
   OR c.merged_into_company_id IS NOT NULL
   OR (
     c.status IS NOT NULL
     AND c.status <> 'active'::public.company_status
   );
