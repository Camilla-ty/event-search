-- ARC-001 Phase 6: public Topic × Region hub supporting reads.
-- event_sponsors stays RLS-gated (anon = tier_rank 1 only). Hubs historically
-- aggregate all-tier company participation via service_role; expose only the
-- edition↔company link needed for that aggregation.
-- Also expose published research-page approvals for sitemap without opening drafts.

CREATE OR REPLACE VIEW public.event_edition_sponsor_companies
WITH (security_invoker = false)
AS
SELECT
  es.event_editions_id,
  es.company_id
FROM public.event_sponsors es
WHERE es.company_id IS NOT NULL;

COMMENT ON VIEW public.event_edition_sponsor_companies IS
  'Identity-free edition↔company sponsor links across all tiers for public hub '
  'aggregations. security_invoker=false. Exposes no tier labels, display order, '
  'or company columns.';

REVOKE ALL ON public.event_edition_sponsor_companies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_edition_sponsor_companies TO anon, authenticated;

CREATE OR REPLACE VIEW public.topic_region_research_pages_published
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.year,
  p.published_at,
  k.name AS topic_name,
  k.slug AS topic_slug,
  r.name AS region_name,
  r.slug AS region_slug
FROM public.topic_region_research_pages p
INNER JOIN public.keyword k
  ON k.id = p.topic_keyword_id
INNER JOIN public.regions r
  ON r.id = p.region_id
WHERE p.status = 'published';

COMMENT ON VIEW public.topic_region_research_pages_published IS
  'Published Topic × Region (× optional year) research pages for public sitemap '
  'and discovery. security_invoker=false. Draft/admin-only rows excluded.';

REVOKE ALL ON public.topic_region_research_pages_published FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.topic_region_research_pages_published TO anon, authenticated;
