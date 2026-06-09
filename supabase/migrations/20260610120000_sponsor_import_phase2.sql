-- Phase 2 — Sponsor Import Migration (phases A–J)
-- Prerequisite: pre-flight P1/P2 passed (no duplicate or NULL event_sponsors pairs).
-- See docs/sponsor-import-migration-design.md

-- =============================================================================
-- Phase A — Enum types
-- =============================================================================

CREATE TYPE public.sponsor_import_batch_status AS ENUM (
  'uploaded',
  'review',
  'draft',
  'published',
  'discarded'
);

CREATE TYPE public.sponsor_import_processing_phase AS ENUM (
  'parsing',
  'validating',
  'matching',
  'importing_to_draft',
  'publishing'
);

CREATE TYPE public.sponsor_import_row_status AS ENUM (
  'needs_review',
  'auto_ready',
  'resolved',
  'excluded'
);

CREATE TYPE public.sponsor_import_match_method AS ENUM (
  'domain',
  'slug',
  'exact_name',
  'fuzzy_name',
  'manual'
);

CREATE TYPE public.sponsor_import_match_confidence AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE public.sponsor_import_conflict_type AS ENUM (
  'domain_name_mismatch',
  'uniqueness_violation',
  'multiple_candidates'
);

CREATE TYPE public.sponsor_import_decision_type AS ENUM (
  'use_matched',
  'create_new',
  'choose_different',
  'exclude'
);

CREATE TYPE public.sponsor_import_decision_source AS ENUM (
  'auto_accepted',
  'admin_manual',
  'bulk_action'
);

CREATE TYPE public.sponsor_import_duplicate_role AS ENUM (
  'canonical',
  'duplicate'
);

CREATE TYPE public.sponsor_import_duplicate_resolution AS ENUM (
  'pending',
  'kept',
  'excluded'
);

CREATE TYPE public.sponsor_import_intended_link_action AS ENUM (
  'create_new_link',
  'update_tier',
  'skip'
);

CREATE TYPE public.sponsor_import_source_file_format AS ENUM (
  'xlsx',
  'xls',
  'csv'
);

CREATE TYPE public.sponsor_import_action_type AS ENUM (
  'upload',
  'column_mapping_saved',
  'validation_run',
  'matching_run',
  'bulk_accept_domain_matches',
  'import_to_draft',
  'review_acknowledged',
  'publish',
  'discard'
);

-- =============================================================================
-- Phase B — sponsor_import_batches
-- =============================================================================

CREATE TABLE public.sponsor_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_edition_id uuid NOT NULL REFERENCES public.event_editions (id),
  status public.sponsor_import_batch_status NOT NULL DEFAULT 'uploaded',
  processing_phase public.sponsor_import_processing_phase,
  source_filename text NOT NULL,
  source_file_storage_path text NOT NULL,
  source_file_format public.sponsor_import_source_file_format NOT NULL,
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

CREATE INDEX idx_sib_edition_status
  ON public.sponsor_import_batches (event_edition_id, status);

CREATE INDEX idx_sib_status_created
  ON public.sponsor_import_batches (status, created_at DESC);

CREATE INDEX idx_sib_created_by
  ON public.sponsor_import_batches (created_by);

-- =============================================================================
-- Phase C — sponsor_import_rows (draft_link_id FK deferred to Phase E)
-- =============================================================================

CREATE TABLE public.sponsor_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.sponsor_import_batches (id) ON DELETE CASCADE,
  excel_row_number integer NOT NULL,
  raw_company_name text,
  raw_website text,
  raw_tier_rank integer,
  normalized_company_name text,
  normalized_website text,
  normalized_domain text,
  proposed_slug text,
  mapped_tier_rank integer,
  status public.sponsor_import_row_status NOT NULL,
  validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_blocking_validation boolean NOT NULL DEFAULT false,
  match_method public.sponsor_import_match_method,
  match_confidence public.sponsor_import_match_confidence,
  proposed_company_id uuid REFERENCES public.companies (id),
  conflict_type public.sponsor_import_conflict_type,
  decision_type public.sponsor_import_decision_type,
  decision_source public.sponsor_import_decision_source,
  resolved_company_id uuid REFERENCES public.companies (id),
  decision_by uuid REFERENCES public.profiles (id),
  decision_at timestamp without time zone,
  decision_notes text,
  duplicate_cluster_key text,
  duplicate_role public.sponsor_import_duplicate_role,
  duplicate_of_row_id uuid REFERENCES public.sponsor_import_rows (id),
  duplicate_resolution public.sponsor_import_duplicate_resolution,
  already_on_live_sponsor_id uuid REFERENCES public.event_sponsors (id),
  already_on_live_tier_rank integer,
  intended_link_action public.sponsor_import_intended_link_action,
  draft_link_id uuid,
  import_error text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_import_rows_batch_excel_row_unique
    UNIQUE (batch_id, excel_row_number)
);

CREATE INDEX idx_sir_batch_status
  ON public.sponsor_import_rows (batch_id, status);

CREATE INDEX idx_sir_batch_blocking
  ON public.sponsor_import_rows (batch_id, has_blocking_validation);

CREATE INDEX idx_sir_batch_duplicate_key
  ON public.sponsor_import_rows (batch_id, duplicate_cluster_key);

CREATE INDEX idx_sir_batch_duplicate_pending
  ON public.sponsor_import_rows (batch_id, duplicate_resolution);

CREATE INDEX idx_sir_normalized_domain
  ON public.sponsor_import_rows (normalized_domain)
  WHERE normalized_domain IS NOT NULL;

-- =============================================================================
-- Phase D — sponsor_import_draft_links
-- =============================================================================

CREATE TABLE public.sponsor_import_draft_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.sponsor_import_batches (id) ON DELETE CASCADE,
  event_edition_id uuid NOT NULL REFERENCES public.event_editions (id),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  tier_rank integer NOT NULL,
  source_import_row_id uuid REFERENCES public.sponsor_import_rows (id),
  excluded_from_publish boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_import_draft_links_batch_company_unique
    UNIQUE (batch_id, company_id)
);

CREATE INDEX idx_sidl_batch
  ON public.sponsor_import_draft_links (batch_id);

CREATE INDEX idx_sidl_edition
  ON public.sponsor_import_draft_links (event_edition_id);

CREATE INDEX idx_sidl_company
  ON public.sponsor_import_draft_links (company_id);

-- =============================================================================
-- Phase E — Cross-FK: draft_link_id on rows
-- =============================================================================

ALTER TABLE public.sponsor_import_rows
  ADD CONSTRAINT sponsor_import_rows_draft_link_id_fkey
  FOREIGN KEY (draft_link_id)
  REFERENCES public.sponsor_import_draft_links (id)
  ON DELETE SET NULL;

-- =============================================================================
-- Phase F — sponsor_import_admin_action_logs
-- =============================================================================

CREATE TABLE public.sponsor_import_admin_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.sponsor_import_batches (id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles (id),
  action_type public.sponsor_import_action_type NOT NULL,
  payload jsonb,
  affected_count integer,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_sial_batch_created
  ON public.sponsor_import_admin_action_logs (batch_id, created_at DESC);

-- =============================================================================
-- Phase G — event_sponsors live uniqueness
-- =============================================================================

ALTER TABLE public.event_sponsors
  ALTER COLUMN event_editions_id SET NOT NULL,
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.event_sponsors
  ADD CONSTRAINT event_sponsors_event_editions_id_company_id_unique
  UNIQUE (event_editions_id, company_id);

-- =============================================================================
-- Phase H — One active import per edition
-- =============================================================================

CREATE UNIQUE INDEX sponsor_import_batches_one_active_per_edition
  ON public.sponsor_import_batches (event_edition_id)
  WHERE status IN (
    'uploaded'::public.sponsor_import_batch_status,
    'review'::public.sponsor_import_batch_status,
    'draft'::public.sponsor_import_batch_status
  );

-- =============================================================================
-- Phase I — RLS on import tables (no anon/authenticated policies)
-- =============================================================================

ALTER TABLE public.sponsor_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_import_draft_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_import_admin_action_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Phase J — Revoke client grants; service role only
-- =============================================================================

REVOKE ALL ON TABLE public.sponsor_import_batches FROM anon, authenticated;
REVOKE ALL ON TABLE public.sponsor_import_rows FROM anon, authenticated;
REVOKE ALL ON TABLE public.sponsor_import_draft_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.sponsor_import_admin_action_logs FROM anon, authenticated;

GRANT ALL ON TABLE public.sponsor_import_batches TO service_role;
GRANT ALL ON TABLE public.sponsor_import_rows TO service_role;
GRANT ALL ON TABLE public.sponsor_import_draft_links TO service_role;
GRANT ALL ON TABLE public.sponsor_import_admin_action_logs TO service_role;
