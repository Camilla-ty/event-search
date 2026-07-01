-- Venue v1 — venues table, event_editions.venue_id, city-match trigger, RLS
-- Prerequisite: pre-flight P1–P6 passed (see docs/venue-migration-design.md)
-- Phases A–F in a single migration file (approved design)

-- =============================================================================
-- Phase A — venues table
-- =============================================================================

CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  city_id uuid NOT NULL REFERENCES public.cities (id) ON DELETE RESTRICT,
  website_url text,
  address_text text,
  logo_url text,
  archived_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.venues IS
  'Reusable named event locations. Archive via archived_at; no hard delete in v1.';

-- =============================================================================
-- Phase B — venues indexes
-- =============================================================================

CREATE UNIQUE INDEX venues_slug_unique ON public.venues (slug);

CREATE INDEX venues_city_id_idx ON public.venues (city_id);

CREATE INDEX venues_active_by_city_idx
  ON public.venues (city_id)
  WHERE archived_at IS NULL;

CREATE INDEX venues_archived_at_idx ON public.venues (archived_at);

-- =============================================================================
-- Phase C — event_editions.venue_id
-- =============================================================================

ALTER TABLE public.event_editions
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues (id) ON DELETE RESTRICT;

CREATE INDEX event_editions_venue_id_idx ON public.event_editions (venue_id);

-- =============================================================================
-- Phase D — venue requires city on edition
-- =============================================================================

ALTER TABLE public.event_editions
  ADD CONSTRAINT event_editions_venue_requires_city_check
  CHECK (venue_id IS NULL OR city_id IS NOT NULL);

-- =============================================================================
-- Phase E — city-match trigger on event_editions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_event_edition_venue_city_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_venue_city_id uuid;
BEGIN
  IF NEW.venue_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.city_id IS NULL THEN
    RAISE EXCEPTION 'event_edition city_id is required when venue_id is set';
  END IF;

  SELECT v.city_id
  INTO v_venue_city_id
  FROM public.venues AS v
  WHERE v.id = NEW.venue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_edition venue_id references a missing venue';
  END IF;

  IF NEW.city_id IS DISTINCT FROM v_venue_city_id THEN
    RAISE EXCEPTION 'event_edition city_id must match the referenced venue city_id';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_event_edition_venue_city_match() IS
  'Ensures event_editions.city_id matches venues.city_id when venue_id is set.';

REVOKE ALL ON FUNCTION public.enforce_event_edition_venue_city_match() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_event_edition_venue_city_match() FROM anon, authenticated;

CREATE TRIGGER event_editions_enforce_venue_city_match
  BEFORE INSERT OR UPDATE OF venue_id, city_id
  ON public.event_editions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_edition_venue_city_match();

-- =============================================================================
-- Phase F — RLS and grants on venues (mirror event_series / event_editions)
-- =============================================================================

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_select_anon_all" ON public.venues;
DROP POLICY IF EXISTS "venues_select_authenticated_all" ON public.venues;

CREATE POLICY "venues_select_anon_all"
  ON public.venues
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "venues_select_authenticated_all"
  ON public.venues
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.venues FROM anon, authenticated;
GRANT SELECT ON TABLE public.venues TO anon, authenticated;
