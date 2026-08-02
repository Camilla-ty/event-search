-- ARC-001 Phase 4: public Event Brand destination index fields (ADR-005 EB4).
-- Exposes only approved, publicly usable Companies + optional same-brand Series
-- columns needed for public href routing. No service_role required.

CREATE OR REPLACE VIEW public.event_brand_public_destinations
WITH (security_invoker = false)
AS
SELECT
  c.id AS company_id,
  c.event_brand_public_profile_approved_at AS approved_at,
  es.id AS series_id,
  es.slug AS series_slug,
  es.name AS series_name,
  es.lifecycle_status AS series_lifecycle_status
FROM public.companies c
LEFT JOIN public.event_series es
  ON es.company_profile_id = c.id
WHERE c.event_brand_public_profile_approved_at IS NOT NULL
  AND c.restricted_at IS NULL
  AND c.merged_into_company_id IS NULL
  AND (
    c.status IS NULL
    OR c.status = 'active'::public.company_status
  );

COMMENT ON VIEW public.event_brand_public_destinations IS
  'Approved Event Brand public destinations (company id + approval timestamp + '
  'optional same-brand Series fields). security_invoker=false. Excludes restricted / '
  'merged / inactive Companies. No private company columns beyond routing needs.';

REVOKE ALL ON public.event_brand_public_destinations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_brand_public_destinations TO anon, authenticated;
