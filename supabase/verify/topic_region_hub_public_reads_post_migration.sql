-- Post-migration checks for Topic × Region hub public reads (ARC-001 Phase 6).

SELECT c.relname AS view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN (
    'event_edition_sponsor_companies',
    'topic_region_research_pages_published'
  )
ORDER BY c.relname;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'event_edition_sponsor_companies',
    'topic_region_research_pages_published'
  )
ORDER BY table_name, ordinal_position;

-- Sponsor-company view must not expose tier or company identity columns.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_edition_sponsor_companies'
  AND column_name IN (
    'tier_rank',
    'tier_label',
    'display_order',
    'name',
    'slug',
    'domain',
    'logo_url'
  );

-- Published research view must not include draft status rows.
SELECT count(*)::integer AS draft_leaks
FROM public.topic_region_research_pages_published pub
INNER JOIN public.topic_region_research_pages raw
  ON raw.id = pub.id
WHERE raw.status <> 'published';

SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'event_edition_sponsor_companies',
    'topic_region_research_pages_published'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
