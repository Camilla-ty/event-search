-- Exhibitor Import v1 (E6) — batch tables, publish RPC, storage bucket
-- Prerequisite: 20260725130000_event_exhibitors_v1.sql applied
-- Design: docs/exhibitor-design.md §10 E6
--
-- Independent of sponsor_import_*. Publishes only to event_exhibitors.
-- Does NOT modify event_sponsors or auto-touch event_editions.last_reviewed_at.

-- =============================================================================
-- Preflight
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.event_exhibitors') IS NULL THEN
    RAISE EXCEPTION 'public.event_exhibitors missing — apply 20260725130000_event_exhibitors_v1.sql first';
  END IF;

  IF to_regclass('public.event_editions') IS NULL THEN
    RAISE EXCEPTION 'public.event_editions missing';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'public.profiles missing';
  END IF;

  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'public.companies missing';
  END IF;
END $$;

-- =============================================================================
-- Phase A — Enum types
-- =============================================================================

CREATE TYPE public.exhibitor_import_batch_status AS ENUM (
  'uploaded',
  'review',
  'draft',
  'published',
  'discarded'
);

CREATE TYPE public.exhibitor_import_processing_phase AS ENUM (
  'parsing',
  'validating',
  'matching',
  'materializing_companies',
  'importing_to_draft',
  'publishing'
);

CREATE TYPE public.exhibitor_import_row_status AS ENUM (
  'needs_review',
  'auto_ready',
  'resolved',
  'excluded'
);

CREATE TYPE public.exhibitor_import_match_method AS ENUM (
  'domain',
  'slug',
  'exact_name',
  'fuzzy_name',
  'manual',
  'alias',
  'website'
);

CREATE TYPE public.exhibitor_import_match_confidence AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE public.exhibitor_import_conflict_type AS ENUM (
  'domain_name_mismatch',
  'uniqueness_violation',
  'multiple_candidates'
);

CREATE TYPE public.exhibitor_import_decision_type AS ENUM (
  'use_matched',
  'create_new',
  'choose_different',
  'exclude'
);

CREATE TYPE public.exhibitor_import_decision_source AS ENUM (
  'auto_accepted',
  'admin_manual',
  'bulk_action'
);

CREATE TYPE public.exhibitor_import_duplicate_role AS ENUM (
  'canonical',
  'duplicate'
);

CREATE TYPE public.exhibitor_import_duplicate_resolution AS ENUM (
  'pending',
  'kept',
  'excluded'
);

CREATE TYPE public.exhibitor_import_intended_link_action AS ENUM (
  'create_new_link',
  'update_tier',
  'skip'
);

CREATE TYPE public.exhibitor_import_source_file_format AS ENUM (
  'xlsx',
  'xls',
  'csv'
);

CREATE TYPE public.exhibitor_import_action_type AS ENUM (
  'upload',
  'column_mapping_saved',
  'validation_run',
  'matching_run',
  'bulk_accept_domain_matches',
  'materialize_companies_chunk',
  'materialize_draft_links_chunk',
  'import_to_draft',
  'review_acknowledged',
  'publish',
  'discard'
);

-- =============================================================================
-- Phase B — exhibitor_import_batches
-- =============================================================================

CREATE TABLE public.exhibitor_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_edition_id uuid NOT NULL REFERENCES public.event_editions (id),
  status public.exhibitor_import_batch_status NOT NULL DEFAULT 'uploaded',
  processing_phase public.exhibitor_import_processing_phase,
  source_filename text NOT NULL,
  source_file_storage_path text NOT NULL,
  source_file_format public.exhibitor_import_source_file_format NOT NULL,
  source_sheet_name text,
  source_row_count integer NOT NULL,
  source_file_checksum text,
  column_mapping jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  published_by uuid REFERENCES public.profiles (id),
  discarded_by uuid REFERENCES public.profiles (id),
  review_acknowledged_by uuid REFERENCES public.profiles (id),
  published_at timestamp without time zone,
  discarded_at timestamp without time zone,
  review_acknowledged_at timestamp without time zone,
  discard_reason text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_eib_edition_status
  ON public.exhibitor_import_batches (event_edition_id, status);

CREATE INDEX idx_eib_status_created
  ON public.exhibitor_import_batches (status, created_at DESC);

CREATE INDEX idx_eib_created_by
  ON public.exhibitor_import_batches (created_by);

CREATE UNIQUE INDEX exhibitor_import_batches_one_active_per_edition
  ON public.exhibitor_import_batches (event_edition_id)
  WHERE status IN (
    'uploaded'::public.exhibitor_import_batch_status,
    'review'::public.exhibitor_import_batch_status,
    'draft'::public.exhibitor_import_batch_status
  );

-- =============================================================================
-- Phase C — exhibitor_import_rows (draft_link_id FK deferred)
-- =============================================================================

CREATE TABLE public.exhibitor_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.exhibitor_import_batches (id) ON DELETE CASCADE,
  excel_row_number integer NOT NULL,
  raw_company_name text,
  raw_website text,
  raw_tier_rank integer,
  raw_tier_label text,
  normalized_company_name text,
  normalized_website text,
  normalized_domain text,
  proposed_slug text,
  mapped_tier_rank integer,
  mapped_tier_label text,
  status public.exhibitor_import_row_status NOT NULL,
  validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_blocking_validation boolean NOT NULL DEFAULT false,
  match_method public.exhibitor_import_match_method,
  match_confidence public.exhibitor_import_match_confidence,
  proposed_company_id uuid REFERENCES public.companies (id),
  conflict_type public.exhibitor_import_conflict_type,
  decision_type public.exhibitor_import_decision_type,
  decision_source public.exhibitor_import_decision_source,
  resolved_company_id uuid REFERENCES public.companies (id),
  decision_by uuid REFERENCES public.profiles (id),
  decision_at timestamp without time zone,
  decision_notes text,
  duplicate_cluster_key text,
  duplicate_role public.exhibitor_import_duplicate_role,
  duplicate_of_row_id uuid REFERENCES public.exhibitor_import_rows (id),
  duplicate_resolution public.exhibitor_import_duplicate_resolution,
  already_on_live_exhibitor_id uuid REFERENCES public.event_exhibitors (id) ON DELETE SET NULL,
  already_on_live_tier_rank integer,
  intended_link_action public.exhibitor_import_intended_link_action,
  draft_link_id uuid,
  import_error text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT exhibitor_import_rows_batch_excel_row_unique
    UNIQUE (batch_id, excel_row_number)
);

CREATE INDEX idx_eir_batch_status
  ON public.exhibitor_import_rows (batch_id, status);

CREATE INDEX idx_eir_batch_blocking
  ON public.exhibitor_import_rows (batch_id, has_blocking_validation);

CREATE INDEX idx_eir_batch_duplicate_key
  ON public.exhibitor_import_rows (batch_id, duplicate_cluster_key);

CREATE INDEX idx_eir_batch_duplicate_pending
  ON public.exhibitor_import_rows (batch_id, duplicate_resolution);

CREATE INDEX idx_eir_normalized_domain
  ON public.exhibitor_import_rows (normalized_domain)
  WHERE normalized_domain IS NOT NULL;

-- =============================================================================
-- Phase D — exhibitor_import_draft_links
-- =============================================================================

CREATE TABLE public.exhibitor_import_draft_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.exhibitor_import_batches (id) ON DELETE CASCADE,
  event_edition_id uuid NOT NULL REFERENCES public.event_editions (id),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  tier_rank integer NOT NULL,
  tier_label text,
  source_import_row_id uuid REFERENCES public.exhibitor_import_rows (id),
  excluded_from_publish boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT exhibitor_import_draft_links_batch_company_unique
    UNIQUE (batch_id, company_id)
);

CREATE INDEX idx_eidl_batch
  ON public.exhibitor_import_draft_links (batch_id);

CREATE INDEX idx_eidl_edition
  ON public.exhibitor_import_draft_links (event_edition_id);

CREATE INDEX idx_eidl_company
  ON public.exhibitor_import_draft_links (company_id);

-- =============================================================================
-- Phase E — Cross-FK: draft_link_id on rows
-- =============================================================================

ALTER TABLE public.exhibitor_import_rows
  ADD CONSTRAINT exhibitor_import_rows_draft_link_id_fkey
  FOREIGN KEY (draft_link_id)
  REFERENCES public.exhibitor_import_draft_links (id)
  ON DELETE SET NULL;

-- =============================================================================
-- Phase F — exhibitor_import_admin_action_logs
-- =============================================================================

CREATE TABLE public.exhibitor_import_admin_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.exhibitor_import_batches (id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles (id),
  action_type public.exhibitor_import_action_type NOT NULL,
  payload jsonb,
  affected_count integer,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_eial_batch_created
  ON public.exhibitor_import_admin_action_logs (batch_id, created_at DESC);

-- =============================================================================
-- Phase G — Publish RPC → event_exhibitors only (never event_sponsors;
--           never touches event_editions.last_reviewed_at)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.exhibitor_import_publish_batch(
  p_batch_id uuid,
  p_published_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.exhibitor_import_batches%ROWTYPE;
  v_link public.exhibitor_import_draft_links%ROWTYPE;
  v_live_id uuid;
  v_live_tier integer;
  v_next_order integer;
  v_new_count integer := 0;
  v_tier_updated_count integer := 0;
  v_unchanged_count integer := 0;
  v_excluded_count integer := 0;
BEGIN
  SELECT * INTO v_batch
  FROM public.exhibitor_import_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch_not_found';
  END IF;

  IF v_batch.status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_batch_status:%', v_batch.status;
  END IF;

  IF v_batch.review_acknowledged_at IS NULL THEN
    RAISE EXCEPTION 'review_not_acknowledged';
  END IF;

  UPDATE public.exhibitor_import_batches
  SET processing_phase = 'publishing', updated_at = now()
  WHERE id = p_batch_id;

  FOR v_link IN
    SELECT *
    FROM public.exhibitor_import_draft_links
    WHERE batch_id = p_batch_id
    ORDER BY created_at, id
  LOOP
    IF v_link.excluded_from_publish THEN
      v_excluded_count := v_excluded_count + 1;
      CONTINUE;
    END IF;

    SELECT id, tier_rank
    INTO v_live_id, v_live_tier
    FROM public.event_exhibitors
    WHERE event_editions_id = v_link.event_edition_id
      AND company_id = v_link.company_id;

    IF v_live_id IS NULL THEN
      SELECT COALESCE(MAX(display_order), 0) + 1
      INTO v_next_order
      FROM public.event_exhibitors
      WHERE event_editions_id = v_link.event_edition_id
        AND tier_rank IS NOT DISTINCT FROM v_link.tier_rank;

      INSERT INTO public.event_exhibitors
        (event_editions_id, company_id, tier_rank, tier_label, display_order)
      VALUES
        (
          v_link.event_edition_id,
          v_link.company_id,
          v_link.tier_rank,
          v_link.tier_label,
          v_next_order
        );
      v_new_count := v_new_count + 1;
    ELSIF v_live_tier IS DISTINCT FROM v_link.tier_rank THEN
      SELECT COALESCE(MAX(display_order), 0) + 1
      INTO v_next_order
      FROM public.event_exhibitors
      WHERE event_editions_id = v_link.event_edition_id
        AND tier_rank IS NOT DISTINCT FROM v_link.tier_rank;

      UPDATE public.event_exhibitors
      SET tier_rank = v_link.tier_rank,
          tier_label = v_link.tier_label,
          display_order = v_next_order,
          updated_at = now()
      WHERE id = v_live_id;
      v_tier_updated_count := v_tier_updated_count + 1;
    ELSE
      UPDATE public.event_exhibitors
      SET tier_label = v_link.tier_label,
          updated_at = now()
      WHERE id = v_live_id;
      v_unchanged_count := v_unchanged_count + 1;
    END IF;
  END LOOP;

  UPDATE public.exhibitor_import_batches
  SET
    status = 'published',
    processing_phase = NULL,
    published_by = p_published_by,
    published_at = now(),
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'new_count', v_new_count,
    'tier_updated_count', v_tier_updated_count,
    'unchanged_count', v_unchanged_count,
    'excluded_count', v_excluded_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.exhibitor_import_publish_batch(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exhibitor_import_publish_batch(uuid, uuid) TO service_role;

-- =============================================================================
-- Phase H — Storage bucket (private; service role via admin API)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'exhibitor-imports',
  'exhibitor-imports',
  false,
  20971520
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- =============================================================================
-- Phase I — RLS (no anon/authenticated policies)
-- =============================================================================

ALTER TABLE public.exhibitor_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibitor_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibitor_import_draft_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibitor_import_admin_action_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Phase J — Revoke client grants; service role only
-- =============================================================================

REVOKE ALL ON TABLE public.exhibitor_import_batches FROM anon, authenticated;
REVOKE ALL ON TABLE public.exhibitor_import_rows FROM anon, authenticated;
REVOKE ALL ON TABLE public.exhibitor_import_draft_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.exhibitor_import_admin_action_logs FROM anon, authenticated;

GRANT ALL ON TABLE public.exhibitor_import_batches TO service_role;
GRANT ALL ON TABLE public.exhibitor_import_rows TO service_role;
GRANT ALL ON TABLE public.exhibitor_import_draft_links TO service_role;
GRANT ALL ON TABLE public.exhibitor_import_admin_action_logs TO service_role;
