-- Partner Alumni Import v1 (PA-IMP-1) — batch tables, storage bucket, RLS
-- Prerequisite: 20260711120000_partner_alumni_v2_versions.sql applied
-- Design: docs/partner-alumni-import-redesign.md §7
--
-- Adds:
--   partner_alumni_import_batches
--   partner_alumni_import_rows
--   partner_alumni_import_action_logs
--   storage bucket partner-alumni-imports (private)
--
-- Does NOT modify sponsor_import_* tables or event_sponsors.

-- =============================================================================
-- Preflight
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.event_partner_alumni_versions') IS NULL THEN
    RAISE EXCEPTION 'public.event_partner_alumni_versions missing — apply 20260711120000_partner_alumni_v2_versions.sql first';
  END IF;

  IF to_regclass('public.event_series') IS NULL THEN
    RAISE EXCEPTION 'public.event_series missing';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'public.profiles missing';
  END IF;
END $$;

-- =============================================================================
-- Phase A — Enum types
-- =============================================================================

CREATE TYPE public.partner_alumni_import_batch_status AS ENUM (
  'uploaded',
  'review',
  'imported',
  'discarded'
);

CREATE TYPE public.partner_alumni_import_processing_phase AS ENUM (
  'parsing',
  'validating',
  'matching',
  'materializing_companies',
  'materializing_members'
);

CREATE TYPE public.partner_alumni_import_row_status AS ENUM (
  'needs_review',
  'auto_ready',
  'resolved',
  'excluded'
);

-- LD-3: domain, alias, exact_name, manual, create_new (no slug/fuzzy_name)
CREATE TYPE public.partner_alumni_import_match_method AS ENUM (
  'domain',
  'alias',
  'exact_name',
  'manual',
  'create_new'
);

CREATE TYPE public.partner_alumni_import_match_confidence AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE public.partner_alumni_import_conflict_type AS ENUM (
  'domain_name_mismatch',
  'uniqueness_violation',
  'multiple_candidates'
);

CREATE TYPE public.partner_alumni_import_decision_type AS ENUM (
  'use_matched',
  'create_new',
  'choose_different',
  'exclude'
);

CREATE TYPE public.partner_alumni_import_decision_source AS ENUM (
  'auto_accepted',
  'admin_manual',
  'bulk_action'
);

CREATE TYPE public.partner_alumni_import_duplicate_role AS ENUM (
  'canonical',
  'duplicate'
);

CREATE TYPE public.partner_alumni_import_duplicate_resolution AS ENUM (
  'pending',
  'kept',
  'excluded'
);

CREATE TYPE public.partner_alumni_import_intended_member_action AS ENUM (
  'create_new_link',
  'skip',
  'update_order'
);

CREATE TYPE public.partner_alumni_import_source_file_format AS ENUM (
  'xlsx',
  'xls',
  'csv'
);

CREATE TYPE public.partner_alumni_import_action_type AS ENUM (
  'upload',
  'column_mapping_saved',
  'validation_run',
  'matching_run',
  'bulk_accept_domain_matches',
  'review_acknowledged',
  'create_new_acknowledged',
  'materialize_companies_chunk',
  'materialize_members_chunk',
  'import_completed',
  'discard'
);

-- =============================================================================
-- Phase B — partner_alumni_import_batches
-- =============================================================================

CREATE TABLE public.partner_alumni_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_series_id uuid NOT NULL REFERENCES public.event_series (id) ON DELETE RESTRICT,
  event_partner_alumni_version_id uuid NOT NULL
    REFERENCES public.event_partner_alumni_versions (id) ON DELETE RESTRICT,
  status public.partner_alumni_import_batch_status NOT NULL DEFAULT 'uploaded',
  processing_phase public.partner_alumni_import_processing_phase,
  source_filename text NOT NULL,
  source_file_storage_path text NOT NULL,
  source_file_format public.partner_alumni_import_source_file_format NOT NULL,
  source_sheet_name text,
  source_row_count integer NOT NULL,
  source_file_checksum text,
  column_mapping jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  imported_by uuid REFERENCES public.profiles (id),
  discarded_by uuid REFERENCES public.profiles (id),
  review_acknowledged_by uuid REFERENCES public.profiles (id),
  create_new_acknowledged_by uuid REFERENCES public.profiles (id),
  review_acknowledged_at timestamp without time zone,
  create_new_acknowledged_at timestamp without time zone,
  create_new_acknowledged_count integer,
  imported_at timestamp without time zone,
  discarded_at timestamp without time zone,
  discard_reason text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT pai_batches_create_new_ack_count_nonneg_chk
    CHECK (create_new_acknowledged_count IS NULL OR create_new_acknowledged_count >= 0)
);

COMMENT ON TABLE public.partner_alumni_import_batches IS
  'Partner Alumni import batch scoped to a version. Service role only; no public publish step.';

COMMENT ON COLUMN public.partner_alumni_import_batches.create_new_acknowledged_count IS
  'LD-6: N new companies acknowledged at create_new_acknowledged_at (audit trail).';

CREATE INDEX pai_batches_series_status_idx
  ON public.partner_alumni_import_batches (event_series_id, status);

CREATE INDEX pai_batches_version_status_idx
  ON public.partner_alumni_import_batches (event_partner_alumni_version_id, status);

CREATE INDEX pai_batches_status_created_idx
  ON public.partner_alumni_import_batches (status, created_at DESC);

CREATE INDEX pai_batches_created_by_idx
  ON public.partner_alumni_import_batches (created_by);

-- One active import per version (uploaded or review in flight)
CREATE UNIQUE INDEX pai_batches_one_active_per_version
  ON public.partner_alumni_import_batches (event_partner_alumni_version_id)
  WHERE status IN (
    'uploaded'::public.partner_alumni_import_batch_status,
    'review'::public.partner_alumni_import_batch_status
  );

-- =============================================================================
-- Phase C — partner_alumni_import_rows
-- =============================================================================

CREATE TABLE public.partner_alumni_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL
    REFERENCES public.partner_alumni_import_batches (id) ON DELETE CASCADE,
  excel_row_number integer NOT NULL,
  raw_company_name text,
  raw_website text,
  raw_display_order text,
  raw_notes text,
  normalized_company_name text,
  normalized_website text,
  normalized_domain text,
  proposed_slug text,
  mapped_display_order integer,
  status public.partner_alumni_import_row_status NOT NULL,
  validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_blocking_validation boolean NOT NULL DEFAULT false,
  match_method public.partner_alumni_import_match_method,
  match_confidence public.partner_alumni_import_match_confidence,
  proposed_company_id uuid REFERENCES public.companies (id),
  conflict_type public.partner_alumni_import_conflict_type,
  decision_type public.partner_alumni_import_decision_type,
  decision_source public.partner_alumni_import_decision_source,
  resolved_company_id uuid REFERENCES public.companies (id),
  decision_by uuid REFERENCES public.profiles (id),
  decision_at timestamp without time zone,
  decision_notes text,
  duplicate_cluster_key text,
  duplicate_role public.partner_alumni_import_duplicate_role,
  duplicate_of_row_id uuid REFERENCES public.partner_alumni_import_rows (id),
  duplicate_resolution public.partner_alumni_import_duplicate_resolution,
  already_on_version_member_id uuid
    REFERENCES public.event_partner_alumni_version_companies (id) ON DELETE SET NULL,
  intended_member_action public.partner_alumni_import_intended_member_action,
  version_member_id uuid
    REFERENCES public.event_partner_alumni_version_companies (id) ON DELETE SET NULL,
  import_error text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT pai_rows_batch_excel_row_unique
    UNIQUE (batch_id, excel_row_number),
  CONSTRAINT pai_rows_mapped_display_order_positive_chk
    CHECK (mapped_display_order IS NULL OR mapped_display_order >= 1)
);

COMMENT ON TABLE public.partner_alumni_import_rows IS
  'Parsed import rows for a Partner Alumni batch. match_method persisted per LD-3.';

COMMENT ON COLUMN public.partner_alumni_import_rows.match_method IS
  'LD-3: domain | alias | exact_name | manual | create_new. Null until matching or explicit decision.';

CREATE INDEX pai_rows_batch_status_idx
  ON public.partner_alumni_import_rows (batch_id, status);

CREATE INDEX pai_rows_batch_blocking_idx
  ON public.partner_alumni_import_rows (batch_id, has_blocking_validation);

CREATE INDEX pai_rows_batch_duplicate_key_idx
  ON public.partner_alumni_import_rows (batch_id, duplicate_cluster_key);

CREATE INDEX pai_rows_batch_duplicate_pending_idx
  ON public.partner_alumni_import_rows (batch_id, duplicate_resolution);

CREATE INDEX pai_rows_normalized_domain_idx
  ON public.partner_alumni_import_rows (normalized_domain)
  WHERE normalized_domain IS NOT NULL;

CREATE INDEX pai_rows_batch_match_method_idx
  ON public.partner_alumni_import_rows (batch_id, match_method);

-- =============================================================================
-- Phase D — partner_alumni_import_action_logs
-- =============================================================================

CREATE TABLE public.partner_alumni_import_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL
    REFERENCES public.partner_alumni_import_batches (id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles (id),
  action_type public.partner_alumni_import_action_type NOT NULL,
  payload jsonb,
  affected_count integer,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.partner_alumni_import_action_logs IS
  'Append-only audit log for Partner Alumni import batches (incl. create_new_acknowledged).';

CREATE INDEX pai_action_logs_batch_created_idx
  ON public.partner_alumni_import_action_logs (batch_id, created_at DESC);

-- =============================================================================
-- Phase E — Storage bucket (private; service role access via admin API)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'partner-alumni-imports',
  'partner-alumni-imports',
  false,
  20971520
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- =============================================================================
-- Phase F — RLS (no anon/authenticated policies)
-- =============================================================================

ALTER TABLE public.partner_alumni_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_alumni_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_alumni_import_action_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Phase G — Revoke client grants; service role only
-- =============================================================================

REVOKE ALL ON TABLE public.partner_alumni_import_batches FROM anon, authenticated;
REVOKE ALL ON TABLE public.partner_alumni_import_rows FROM anon, authenticated;
REVOKE ALL ON TABLE public.partner_alumni_import_action_logs FROM anon, authenticated;

GRANT ALL ON TABLE public.partner_alumni_import_batches TO service_role;
GRANT ALL ON TABLE public.partner_alumni_import_rows TO service_role;
GRANT ALL ON TABLE public.partner_alumni_import_action_logs TO service_role;
