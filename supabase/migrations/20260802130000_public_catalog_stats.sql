-- ARC-001 Phase 3: identity-free public catalog counters for homepage/API stats.
-- Mirrors company_sponsor_stats / event_edition_sponsor_* aggregates:
-- security_invoker=false so anon/authenticated read full totals without service_role.

CREATE OR REPLACE VIEW public.public_catalog_stats
WITH (security_invoker = false)
AS
SELECT
  (SELECT count(*)::integer FROM public.event_editions) AS events,
  (SELECT count(*)::integer FROM public.companies) AS sponsors,
  (SELECT count(*)::integer FROM public.event_edition_organizers) AS organizers,
  (
    SELECT count(DISTINCT ee.city_id)::integer
    FROM public.event_editions ee
    WHERE ee.city_id IS NOT NULL
  ) AS event_cities;

COMMENT ON VIEW public.public_catalog_stats IS
  'Single-row public catalog counters (events, companies-as-sponsors, organizers, '
  'distinct edition cities). security_invoker=false; exposes aggregates only — '
  'no row-level identities.';

REVOKE ALL ON public.public_catalog_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_catalog_stats TO anon, authenticated;
