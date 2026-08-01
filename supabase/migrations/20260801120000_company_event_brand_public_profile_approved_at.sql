-- ADR-005 / EB0 — Event Brand public-profile approval (per Company)
-- docs/adr/ADR-005-event-brand-public-profile-policy.md
-- docs/phase-event-brand-public-profile-scope.md
--
-- Separate from event_series.company_profile_id (ADR-004 same-brand link).
-- NULL = not approved (default). Non-null timestamptz = Admin manually approved.
-- No backfill / auto-approve.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS event_brand_public_profile_approved_at timestamptz;

COMMENT ON COLUMN public.companies.event_brand_public_profile_approved_at IS
  'ADR-005 EB0: when set, Admin approved using the linked Event Series as this '
  'Company''s public profile (future routing). NULL = not approved. '
  'Requires an active same-brand Series link; independent of role joins. '
  'Admin-managed only; not written by imports or auto-detect.';
