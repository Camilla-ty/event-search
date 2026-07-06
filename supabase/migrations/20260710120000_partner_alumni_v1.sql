-- Partner Alumni v1 — series-scoped program, draft roster, verified snapshots + RLS
-- Prerequisite: pre-flight P1–P8 passed (see docs/partner-alumni-migration-design.md)
-- Phases A–G in a single migration file (approved design)

-- =============================================================================
-- Phase A — event_partner_alumni (program header; latest_snapshot_id added in Phase E)
-- =============================================================================

CREATE TABLE public.event_partner_alumni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_series_id uuid NOT NULL REFERENCES public.event_series (id) ON DELETE RESTRICT,
  recognition_label text,
  primary_source_url text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_partner_alumni_recognition_label_max_length_check
    CHECK (recognition_label IS NULL OR char_length(recognition_label) <= 200),
  CONSTRAINT event_partner_alumni_primary_source_url_max_length_check
    CHECK (primary_source_url IS NULL OR char_length(primary_source_url) <= 2048)
);

COMMENT ON TABLE public.event_partner_alumni IS
  'One Partner Alumni program per event series (v1). Draft header fields; latest verified snapshot via latest_snapshot_id.';

CREATE UNIQUE INDEX event_partner_alumni_series_unique
  ON public.event_partner_alumni (event_series_id);

-- =============================================================================
-- Phase B — event_partner_alumni_companies (editable draft roster)
-- =============================================================================

CREATE TABLE public.event_partner_alumni_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_partner_alumni_id uuid NOT NULL REFERENCES public.event_partner_alumni (id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  display_order integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_partner_alumni_companies_display_order_positive_check
    CHECK (display_order >= 1)
);

COMMENT ON TABLE public.event_partner_alumni_companies IS
  'Draft Partner Alumni roster members. Editable until Verify copies to snapshot tables.';

CREATE UNIQUE INDEX event_partner_alumni_companies_program_company_unique
  ON public.event_partner_alumni_companies (event_partner_alumni_id, company_id);

CREATE INDEX event_partner_alumni_companies_program_order_idx
  ON public.event_partner_alumni_companies (event_partner_alumni_id, display_order);

CREATE INDEX event_partner_alumni_companies_company_id_idx
  ON public.event_partner_alumni_companies (company_id);

-- =============================================================================
-- Phase C — event_partner_alumni_snapshots (immutable verified headers)
-- =============================================================================

CREATE TABLE public.event_partner_alumni_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_partner_alumni_id uuid NOT NULL REFERENCES public.event_partner_alumni (id) ON DELETE RESTRICT,
  recognition_label text,
  primary_source_url text,
  verified_at timestamptz NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_partner_alumni_snapshots_recognition_label_max_length_check
    CHECK (recognition_label IS NULL OR char_length(recognition_label) <= 200),
  CONSTRAINT event_partner_alumni_snapshots_primary_source_url_max_length_check
    CHECK (primary_source_url IS NULL OR char_length(primary_source_url) <= 2048)
);

COMMENT ON TABLE public.event_partner_alumni_snapshots IS
  'Immutable Partner Alumni snapshots created only by admin Verify. Public reads latest via event_partner_alumni.latest_snapshot_id.';

CREATE INDEX event_partner_alumni_snapshots_program_verified_idx
  ON public.event_partner_alumni_snapshots (event_partner_alumni_id, verified_at DESC);

-- =============================================================================
-- Phase D — event_partner_alumni_snapshot_companies (immutable snapshot members)
-- =============================================================================

CREATE TABLE public.event_partner_alumni_snapshot_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_partner_alumni_snapshot_id uuid NOT NULL
    REFERENCES public.event_partner_alumni_snapshots (id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  display_order integer NOT NULL,
  CONSTRAINT event_partner_alumni_snapshot_companies_display_order_positive_check
    CHECK (display_order >= 1)
);

COMMENT ON TABLE public.event_partner_alumni_snapshot_companies IS
  'Immutable company roster copy for a verified Partner Alumni snapshot.';

CREATE UNIQUE INDEX event_partner_alumni_snapshot_companies_snapshot_company_unique
  ON public.event_partner_alumni_snapshot_companies (event_partner_alumni_snapshot_id, company_id);

CREATE INDEX event_partner_alumni_snapshot_companies_snapshot_order_idx
  ON public.event_partner_alumni_snapshot_companies (event_partner_alumni_snapshot_id, display_order);

CREATE INDEX event_partner_alumni_snapshot_companies_company_id_idx
  ON public.event_partner_alumni_snapshot_companies (company_id);

-- =============================================================================
-- Phase E — latest_snapshot_id pointer on program header
-- =============================================================================

ALTER TABLE public.event_partner_alumni
  ADD COLUMN latest_snapshot_id uuid
    REFERENCES public.event_partner_alumni_snapshots (id) ON DELETE RESTRICT;

CREATE INDEX event_partner_alumni_latest_snapshot_id_idx
  ON public.event_partner_alumni (latest_snapshot_id)
  WHERE latest_snapshot_id IS NOT NULL;

-- =============================================================================
-- Phase G — RLS and grants
-- Draft tables: RLS enabled, no anon/authenticated policies (default deny)
-- Snapshot tables: public SELECT (mirror organizer / catalog read)
-- =============================================================================

-- --- event_partner_alumni (draft-private header) ---

ALTER TABLE public.event_partner_alumni ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_partner_alumni FROM anon, authenticated;

-- --- event_partner_alumni_companies (draft-private roster) ---

ALTER TABLE public.event_partner_alumni_companies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_partner_alumni_companies FROM anon, authenticated;

-- --- event_partner_alumni_snapshots (public verified history) ---

ALTER TABLE public.event_partner_alumni_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_partner_alumni_snapshots_select_anon_all"
  ON public.event_partner_alumni_snapshots;
DROP POLICY IF EXISTS "event_partner_alumni_snapshots_select_authenticated_all"
  ON public.event_partner_alumni_snapshots;

CREATE POLICY "event_partner_alumni_snapshots_select_anon_all"
  ON public.event_partner_alumni_snapshots
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "event_partner_alumni_snapshots_select_authenticated_all"
  ON public.event_partner_alumni_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.event_partner_alumni_snapshots FROM anon, authenticated;
GRANT SELECT ON TABLE public.event_partner_alumni_snapshots TO anon, authenticated;

-- --- event_partner_alumni_snapshot_companies (public verified members) ---

ALTER TABLE public.event_partner_alumni_snapshot_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_partner_alumni_snapshot_companies_select_anon_all"
  ON public.event_partner_alumni_snapshot_companies;
DROP POLICY IF EXISTS "event_partner_alumni_snapshot_companies_select_authenticated_all"
  ON public.event_partner_alumni_snapshot_companies;

CREATE POLICY "event_partner_alumni_snapshot_companies_select_anon_all"
  ON public.event_partner_alumni_snapshot_companies
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "event_partner_alumni_snapshot_companies_select_authenticated_all"
  ON public.event_partner_alumni_snapshot_companies
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.event_partner_alumni_snapshot_companies FROM anon, authenticated;
GRANT SELECT ON TABLE public.event_partner_alumni_snapshot_companies TO anon, authenticated;
