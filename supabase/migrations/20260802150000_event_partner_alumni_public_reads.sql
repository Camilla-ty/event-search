-- ARC-001 Phase 5: public Partner Alumni current-version reads only.
-- Underlying event_partner_alumni / versions / version_companies stay
-- service_role-only (RLS revoke for anon/authenticated unchanged).
-- Views use security_invoker=false so anon can resolve the published pointer
-- without SELECT on draft/historical version tables.

CREATE OR REPLACE VIEW public.event_partner_alumni_public_versions
WITH (security_invoker = false)
AS
SELECT
  epa.event_series_id,
  v.recognition_label,
  v.primary_source_url,
  v.source_checked_at
FROM public.event_partner_alumni epa
INNER JOIN public.event_partner_alumni_versions v
  ON v.id = epa.current_version_id
WHERE epa.current_version_id IS NOT NULL;

COMMENT ON VIEW public.event_partner_alumni_public_versions IS
  'Published Partner Alumni version headers only (via current_version_id). '
  'security_invoker=false. Exposes no draft/historical versions or admin fields.';

REVOKE ALL ON public.event_partner_alumni_public_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_partner_alumni_public_versions TO anon, authenticated;

CREATE OR REPLACE VIEW public.event_partner_alumni_public_members
WITH (security_invoker = false)
AS
SELECT
  epa.event_series_id,
  m.id AS member_id,
  m.display_order,
  c.id AS company_id,
  c.name AS company_name,
  c.slug AS company_slug,
  c.domain AS company_domain,
  c.website AS company_website,
  c.logo_url AS company_logo_url,
  c.logo_source AS company_logo_source,
  c.logo_status AS company_logo_status,
  c.restricted_at AS company_restricted_at,
  c.event_brand_public_profile_approved_at AS company_event_brand_public_profile_approved_at
FROM public.event_partner_alumni epa
INNER JOIN public.event_partner_alumni_version_companies m
  ON m.event_partner_alumni_version_id = epa.current_version_id
LEFT JOIN public.companies c
  ON c.id = m.company_id
WHERE epa.current_version_id IS NOT NULL;

COMMENT ON VIEW public.event_partner_alumni_public_members IS
  'Published Partner Alumni members for the current version only. '
  'security_invoker=false. Includes public company fields needed for roster display '
  '(restricted_at retained for app-level masking). No draft/historical members.';

REVOKE ALL ON public.event_partner_alumni_public_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_partner_alumni_public_members TO anon, authenticated;
