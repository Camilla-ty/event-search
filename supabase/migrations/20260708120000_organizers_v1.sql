-- Organizer v1 — event_edition_organizers join table + RLS
-- Prerequisite: pre-flight P1–P8 passed (see docs/organizer-migration-design.md)
-- Phases A–C in a single migration file (approved design)

-- =============================================================================
-- Phase A — event_edition_organizers table
-- =============================================================================

CREATE TABLE public.event_edition_organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_editions_id uuid NOT NULL REFERENCES public.event_editions (id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  role_label text NOT NULL DEFAULT 'Organizer',
  display_order integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_edition_organizers_role_label_nonempty_check
    CHECK (char_length(trim(role_label)) >= 1),
  CONSTRAINT event_edition_organizers_role_label_max_length_check
    CHECK (char_length(role_label) <= 80),
  CONSTRAINT event_edition_organizers_display_order_positive_check
    CHECK (display_order >= 1)
);

COMMENT ON TABLE public.event_edition_organizers IS
  'Edition-scoped organizer links to companies. One row per (edition, company).';

-- =============================================================================
-- Phase B — unique constraint + indexes
-- =============================================================================

CREATE UNIQUE INDEX event_edition_organizers_edition_company_unique
  ON public.event_edition_organizers (event_editions_id, company_id);

CREATE INDEX event_edition_organizers_edition_order_idx
  ON public.event_edition_organizers (event_editions_id, display_order);

CREATE INDEX event_edition_organizers_company_id_idx
  ON public.event_edition_organizers (company_id);

-- =============================================================================
-- Phase C — RLS and grants (mirror venues / catalog public read)
-- =============================================================================

ALTER TABLE public.event_edition_organizers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_edition_organizers_select_anon_all" ON public.event_edition_organizers;
DROP POLICY IF EXISTS "event_edition_organizers_select_authenticated_all" ON public.event_edition_organizers;

CREATE POLICY "event_edition_organizers_select_anon_all"
  ON public.event_edition_organizers
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "event_edition_organizers_select_authenticated_all"
  ON public.event_edition_organizers
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.event_edition_organizers FROM anon, authenticated;
GRANT SELECT ON TABLE public.event_edition_organizers TO anon, authenticated;
