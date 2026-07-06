-- Partner Alumni v2 (PA1′) — corrective migration: snapshot model → version model
-- Prerequisite: 20260710120000_partner_alumni_v1.sql applied
-- Design: docs/partner-alumni-migration-design.md §5.2
--
-- OQ3: rename/evolve snapshot tables in place (no parallel version system)
-- OQ4: discard all event_partner_alumni_companies draft rows
-- OQ7: public reads server-resolved via current_version_id; revoke anon/authenticated SELECT
--
-- Constraint/index names use short pa_* prefixes to stay under Postgres 63-char identifier limit.
-- FK/CHECK constraints are drop-and-recreate (not renamed) to avoid truncated-name mismatches.
-- Steps are idempotent for safe re-run after a failed partial attempt.

-- =============================================================================
-- Preflight
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.event_partner_alumni') IS NULL THEN
    RAISE EXCEPTION 'public.event_partner_alumni missing — apply 20260710120000_partner_alumni_v1.sql first';
  END IF;

  IF to_regclass('public.event_partner_alumni_snapshots') IS NULL
     AND to_regclass('public.event_partner_alumni_versions') IS NULL THEN
    RAISE EXCEPTION 'Neither snapshots nor versions table found — unexpected Partner Alumni schema state';
  END IF;
END $$;

-- =============================================================================
-- Phase 1 — Drop draft layer (OQ4)
-- =============================================================================

DROP TABLE IF EXISTS public.event_partner_alumni_companies;

-- =============================================================================
-- Phase 2 — Rename snapshot → version tables (OQ3)
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.event_partner_alumni_snapshots') IS NOT NULL
     AND to_regclass('public.event_partner_alumni_versions') IS NULL THEN
    ALTER TABLE public.event_partner_alumni_snapshots
      RENAME TO event_partner_alumni_versions;
  END IF;

  IF to_regclass('public.event_partner_alumni_snapshot_companies') IS NOT NULL
     AND to_regclass('public.event_partner_alumni_version_companies') IS NULL THEN
    ALTER TABLE public.event_partner_alumni_snapshot_companies
      RENAME TO event_partner_alumni_version_companies;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_partner_alumni_version_companies'
      AND column_name = 'event_partner_alumni_snapshot_id'
  ) THEN
    ALTER TABLE public.event_partner_alumni_version_companies
      RENAME COLUMN event_partner_alumni_snapshot_id
      TO event_partner_alumni_version_id;
  END IF;
END $$;

-- Primary keys — short stable names (rename when legacy name still present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_versions'::regclass
      AND conname = 'event_partner_alumni_snapshots_pkey'
  ) THEN
    ALTER TABLE public.event_partner_alumni_versions
      RENAME CONSTRAINT event_partner_alumni_snapshots_pkey TO pa_versions_pkey;
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_versions'::regclass
      AND conname = 'event_partner_alumni_versions_pkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_versions'::regclass
      AND conname = 'pa_versions_pkey'
  ) THEN
    ALTER TABLE public.event_partner_alumni_versions
      RENAME CONSTRAINT event_partner_alumni_versions_pkey TO pa_versions_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_version_companies'::regclass
      AND conname = 'event_partner_alumni_snapshot_companies_pkey'
  ) THEN
    ALTER TABLE public.event_partner_alumni_version_companies
      RENAME CONSTRAINT event_partner_alumni_snapshot_companies_pkey TO pa_vc_pkey;
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_version_companies'::regclass
      AND conname = 'event_partner_alumni_version_companies_pkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_version_companies'::regclass
      AND conname = 'pa_vc_pkey'
  ) THEN
    ALTER TABLE public.event_partner_alumni_version_companies
      RENAME CONSTRAINT event_partner_alumni_version_companies_pkey TO pa_vc_pkey;
  END IF;
END $$;

-- Foreign keys — drop any legacy FK on target columns, then add short-named FKs
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.event_partner_alumni_versions'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'pa_versions_program_fkey'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.event_partner_alumni_versions DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_versions'::regclass
      AND conname = 'pa_versions_program_fkey'
  ) THEN
    ALTER TABLE public.event_partner_alumni_versions
      ADD CONSTRAINT pa_versions_program_fkey
      FOREIGN KEY (event_partner_alumni_id)
      REFERENCES public.event_partner_alumni (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.event_partner_alumni_version_companies'::regclass
      AND c.contype = 'f'
      AND c.conname NOT IN ('pa_vc_version_fkey', 'pa_vc_company_fkey')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.event_partner_alumni_version_companies DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_version_companies'::regclass
      AND conname = 'pa_vc_version_fkey'
  ) THEN
    ALTER TABLE public.event_partner_alumni_version_companies
      ADD CONSTRAINT pa_vc_version_fkey
      FOREIGN KEY (event_partner_alumni_version_id)
      REFERENCES public.event_partner_alumni_versions (id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_version_companies'::regclass
      AND conname = 'pa_vc_company_fkey'
  ) THEN
    ALTER TABLE public.event_partner_alumni_version_companies
      ADD CONSTRAINT pa_vc_company_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- CHECK constraints — drop legacy checks, add short-named checks
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.event_partner_alumni_versions'::regclass
      AND c.contype = 'c'
      AND c.conname NOT IN (
        'pa_versions_recognition_label_chk',
        'pa_versions_source_url_chk'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.event_partner_alumni_versions DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_versions'::regclass
      AND conname = 'pa_versions_recognition_label_chk'
  ) THEN
    ALTER TABLE public.event_partner_alumni_versions
      ADD CONSTRAINT pa_versions_recognition_label_chk
      CHECK (recognition_label IS NULL OR char_length(recognition_label) <= 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_versions'::regclass
      AND conname = 'pa_versions_source_url_chk'
  ) THEN
    ALTER TABLE public.event_partner_alumni_versions
      ADD CONSTRAINT pa_versions_source_url_chk
      CHECK (primary_source_url IS NULL OR char_length(primary_source_url) <= 2048);
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.event_partner_alumni_version_companies'::regclass
      AND c.contype = 'c'
      AND c.conname <> 'pa_vc_display_order_chk'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.event_partner_alumni_version_companies DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni_version_companies'::regclass
      AND conname = 'pa_vc_display_order_chk'
  ) THEN
    ALTER TABLE public.event_partner_alumni_version_companies
      ADD CONSTRAINT pa_vc_display_order_chk
      CHECK (display_order >= 1);
  END IF;
END $$;

-- Indexes — drop legacy names, create short-named indexes
DROP INDEX IF EXISTS public.event_partner_alumni_snapshots_program_verified_idx;
DROP INDEX IF EXISTS public.event_partner_alumni_versions_program_verified_idx;

CREATE INDEX IF NOT EXISTS pa_versions_program_created_idx
  ON public.event_partner_alumni_versions (event_partner_alumni_id, created_at DESC);

DROP INDEX IF EXISTS public.event_partner_alumni_snapshot_companies_snapshot_company_unique;
DROP INDEX IF EXISTS public.event_partner_alumni_version_companies_version_company_unique;

CREATE UNIQUE INDEX IF NOT EXISTS pa_vc_version_company_uq
  ON public.event_partner_alumni_version_companies (event_partner_alumni_version_id, company_id);

DROP INDEX IF EXISTS public.event_partner_alumni_snapshot_companies_snapshot_order_idx;
DROP INDEX IF EXISTS public.event_partner_alumni_version_companies_version_order_idx;

CREATE INDEX IF NOT EXISTS pa_vc_version_order_idx
  ON public.event_partner_alumni_version_companies (event_partner_alumni_version_id, display_order);

DROP INDEX IF EXISTS public.event_partner_alumni_snapshot_companies_company_id_idx;
DROP INDEX IF EXISTS public.event_partner_alumni_version_companies_company_id_idx;

CREATE INDEX IF NOT EXISTS pa_vc_company_idx
  ON public.event_partner_alumni_version_companies (company_id);

COMMENT ON TABLE public.event_partner_alumni_versions IS
  'Editable Partner Alumni version roster container per program. Public reads current version only via event_partner_alumni.current_version_id (server-resolved).';

COMMENT ON TABLE public.event_partner_alumni_version_companies IS
  'Partner Alumni roster members for a version. Editable until version is deleted.';

-- =============================================================================
-- Phase 3 — Version header columns
-- =============================================================================

ALTER TABLE public.event_partner_alumni_versions
  ADD COLUMN IF NOT EXISTS version_label text,
  ADD COLUMN IF NOT EXISTS source_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_partner_alumni_versions'
      AND column_name = 'verified_at'
  ) THEN
    UPDATE public.event_partner_alumni_versions
    SET source_checked_at = verified_at
    WHERE verified_at IS NOT NULL
      AND source_checked_at IS NULL;

    ALTER TABLE public.event_partner_alumni_versions
      DROP COLUMN verified_at;
  END IF;
END $$;

-- =============================================================================
-- Phase 4 — Version member columns
-- =============================================================================

ALTER TABLE public.event_partner_alumni_version_companies
  ADD COLUMN IF NOT EXISTS created_at timestamp without time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone NOT NULL DEFAULT now();

-- =============================================================================
-- Phase 5 — Program pointer (replace latest_snapshot_id)
-- =============================================================================

ALTER TABLE public.event_partner_alumni
  ADD COLUMN IF NOT EXISTS current_version_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_partner_alumni'
      AND column_name = 'latest_snapshot_id'
  ) THEN
    UPDATE public.event_partner_alumni
    SET current_version_id = latest_snapshot_id
    WHERE latest_snapshot_id IS NOT NULL
      AND current_version_id IS NULL;
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.event_partner_alumni'::regclass
      AND c.contype = 'f'
      AND a.attname = 'latest_snapshot_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.event_partner_alumni DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.event_partner_alumni_latest_snapshot_id_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_partner_alumni'
      AND column_name = 'latest_snapshot_id'
  ) THEN
    ALTER TABLE public.event_partner_alumni
      DROP COLUMN latest_snapshot_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_partner_alumni'
      AND column_name = 'recognition_label'
  ) THEN
    ALTER TABLE public.event_partner_alumni
      DROP COLUMN recognition_label;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_partner_alumni'
      AND column_name = 'primary_source_url'
  ) THEN
    ALTER TABLE public.event_partner_alumni
      DROP COLUMN primary_source_url;
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.event_partner_alumni'::regclass
      AND c.contype = 'f'
      AND a.attname = 'current_version_id'
      AND c.conname <> 'pa_program_current_version_fkey'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.event_partner_alumni DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_partner_alumni'::regclass
      AND conname = 'pa_program_current_version_fkey'
  ) THEN
    ALTER TABLE public.event_partner_alumni
      ADD CONSTRAINT pa_program_current_version_fkey
      FOREIGN KEY (current_version_id)
      REFERENCES public.event_partner_alumni_versions (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DROP INDEX IF EXISTS public.event_partner_alumni_current_version_id_idx;

CREATE INDEX IF NOT EXISTS pa_program_current_version_idx
  ON public.event_partner_alumni (current_version_id)
  WHERE current_version_id IS NOT NULL;

COMMENT ON TABLE public.event_partner_alumni IS
  'One Partner Alumni program per event series (v2). Public pointer via current_version_id; version metadata on event_partner_alumni_versions.';

-- =============================================================================
-- Phase 6 — RLS revision (OQ7: server-resolved public reads only)
-- =============================================================================

-- Drop all policies on version tables (handles truncated v1 policy names)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.polname, c.relname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'event_partner_alumni_versions',
        'event_partner_alumni_version_companies'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.polname, r.relname);
  END LOOP;
END $$;

ALTER TABLE public.event_partner_alumni_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_partner_alumni_versions FROM anon, authenticated;

ALTER TABLE public.event_partner_alumni_version_companies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_partner_alumni_version_companies FROM anon, authenticated;
