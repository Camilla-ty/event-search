-- ARC-001 Phase 2: identity-free public aggregates for edition sponsor counts
-- and per-tier summaries (ADR-003). Mirrors company_sponsor_stats:
-- security_invoker=false so anon/authenticated can read all-tier counts without
-- reading Tier 2+ event_sponsors identity rows via RLS.

CREATE OR REPLACE VIEW public.event_edition_sponsor_counts
WITH (security_invoker = false)
AS
SELECT
  es.event_editions_id,
  count(*)::integer AS sponsor_count
FROM public.event_sponsors es
GROUP BY es.event_editions_id;

COMMENT ON VIEW public.event_edition_sponsor_counts IS
  'All-tier sponsor link counts per event edition. '
  'security_invoker=false so public surfaces can read full totals without '
  'service_role or Tier 2+ event_sponsors row access. Exposes no company fields.';

REVOKE ALL ON public.event_edition_sponsor_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_edition_sponsor_counts TO anon, authenticated;

CREATE OR REPLACE VIEW public.event_edition_sponsor_tier_stats
WITH (security_invoker = false)
AS
SELECT
  es.event_editions_id,
  es.tier_rank,
  (
    array_agg(
      nullif(btrim(es.tier_label), '')
      ORDER BY es.display_order ASC NULLS LAST, es.id ASC
    ) FILTER (WHERE nullif(btrim(es.tier_label), '') IS NOT NULL)
  )[1] AS tier_label,
  count(*)::integer AS sponsor_count
FROM public.event_sponsors es
GROUP BY es.event_editions_id, es.tier_rank;

COMMENT ON VIEW public.event_edition_sponsor_tier_stats IS
  'Identity-free per-tier sponsor counts/labels for an edition (ADR-003 chrome). '
  'security_invoker=false so anon may observe all-tier counts without company identities. '
  'Exposes no company identity columns (name, domain, logo, or slug).';

REVOKE ALL ON public.event_edition_sponsor_tier_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_edition_sponsor_tier_stats TO anon, authenticated;
