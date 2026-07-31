-- ADR-004 / SB0 — optional Event Series ↔ Company same-brand profile link
-- docs/adr/ADR-004-event-series-company-same-brand-link.md
-- docs/phase-event-series-company-same-brand-scope.md

-- Nullable FK: at most one Company per Series.
-- UNIQUE (company_profile_id): at most one Series per Company (PostgreSQL allows multiple NULLs).
-- ON DELETE RESTRICT: clearing the link must be an explicit Admin unlink (no cascade/set null).

ALTER TABLE public.event_series
  ADD COLUMN IF NOT EXISTS company_profile_id uuid;

COMMENT ON COLUMN public.event_series.company_profile_id IS
  'Optional same-brand Company profile (ADR-004). NULL = no link. '
  '1:1 with companies via event_series_company_profile_id_key. '
  'Admin-managed only; not written by imports.';

ALTER TABLE public.event_series
  DROP CONSTRAINT IF EXISTS event_series_company_profile_id_fkey;

ALTER TABLE public.event_series
  ADD CONSTRAINT event_series_company_profile_id_fkey
  FOREIGN KEY (company_profile_id)
  REFERENCES public.companies (id)
  ON DELETE RESTRICT;

ALTER TABLE public.event_series
  DROP CONSTRAINT IF EXISTS event_series_company_profile_id_key;

ALTER TABLE public.event_series
  ADD CONSTRAINT event_series_company_profile_id_key
  UNIQUE (company_profile_id);
