-- Post-migration verification for Partner Alumni v1 (V1–V16)
-- Run after applying 20260710120000_partner_alumni_v1.sql:
--   supabase db query --linked -f supabase/verify/partner_alumni_v1_post_migration.sql
--
-- Catalog checks (V1–V12, V13–V14) are read-only SELECTs.
-- Behavioral checks (V15–V16, CHECK constraints) run in a transaction and roll back.

-- =============================================================================
-- Schema — event_partner_alumni (V1a)
-- =============================================================================

SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_partner_alumni'
  AND column_name IN (
    'id',
    'event_series_id',
    'recognition_label',
    'primary_source_url',
    'latest_snapshot_id',
    'created_at',
    'updated_at'
  )
ORDER BY column_name;

SELECT tc.constraint_name, kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'event_partner_alumni'
  AND tc.constraint_type = 'PRIMARY KEY';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'event_partner_alumni'
  AND indexname = 'event_partner_alumni_series_unique';

-- =============================================================================
-- Schema — event_partner_alumni_companies (V1b)
-- =============================================================================

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_partner_alumni_companies'
  AND column_name IN (
    'id',
    'event_partner_alumni_id',
    'company_id',
    'display_order',
    'created_at',
    'updated_at'
  )
ORDER BY column_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'event_partner_alumni_companies'
  AND indexname IN (
    'event_partner_alumni_companies_program_company_unique',
    'event_partner_alumni_companies_program_order_idx',
    'event_partner_alumni_companies_company_id_idx'
  )
ORDER BY indexname;

-- =============================================================================
-- Schema — event_partner_alumni_snapshots (V1c)
-- =============================================================================

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_partner_alumni_snapshots'
  AND column_name IN (
    'id',
    'event_partner_alumni_id',
    'recognition_label',
    'primary_source_url',
    'verified_at',
    'created_at'
  )
ORDER BY column_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'event_partner_alumni_snapshots'
  AND indexname = 'event_partner_alumni_snapshots_program_verified_idx';

-- =============================================================================
-- Schema — event_partner_alumni_snapshot_companies (V1d)
-- =============================================================================

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_partner_alumni_snapshot_companies'
  AND column_name IN (
    'id',
    'event_partner_alumni_snapshot_id',
    'company_id',
    'display_order'
  )
ORDER BY column_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'event_partner_alumni_snapshot_companies'
  AND indexname IN (
    'event_partner_alumni_snapshot_companies_snapshot_company_unique',
    'event_partner_alumni_snapshot_companies_snapshot_order_idx',
    'event_partner_alumni_snapshot_companies_company_id_idx'
  )
ORDER BY indexname;

-- =============================================================================
-- FKs with ON DELETE RESTRICT (V3)
-- =============================================================================

SELECT
  rel.relname AS table_name,
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint AS c
JOIN pg_class AS rel ON rel.oid = c.conrelid
JOIN pg_namespace AS n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND rel.relname IN (
    'event_partner_alumni',
    'event_partner_alumni_companies',
    'event_partner_alumni_snapshots',
    'event_partner_alumni_snapshot_companies'
  )
  AND c.contype = 'f'
ORDER BY rel.relname, c.conname;

-- =============================================================================
-- CHECK constraints (V8)
-- =============================================================================

SELECT rel.relname AS table_name, c.conname AS constraint_name, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint AS c
JOIN pg_class AS rel ON rel.oid = c.conrelid
JOIN pg_namespace AS n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND rel.relname IN (
    'event_partner_alumni',
    'event_partner_alumni_companies',
    'event_partner_alumni_snapshots',
    'event_partner_alumni_snapshot_companies'
  )
  AND c.contype = 'c'
ORDER BY rel.relname, c.conname;

-- =============================================================================
-- RLS (V9–V12)
-- =============================================================================

SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'event_partner_alumni',
    'event_partner_alumni_companies',
    'event_partner_alumni_snapshots',
    'event_partner_alumni_snapshot_companies'
  )
ORDER BY c.relname;

-- V10: draft tables — no SELECT policies for anon/authenticated
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('event_partner_alumni', 'event_partner_alumni_companies')
ORDER BY tablename, policyname;

-- V11: snapshot tables — SELECT policies present
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'event_partner_alumni_snapshots',
    'event_partner_alumni_snapshot_companies'
  )
ORDER BY tablename, policyname;

-- V12: grants summary
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'event_partner_alumni',
    'event_partner_alumni_companies',
    'event_partner_alumni_snapshots',
    'event_partner_alumni_snapshot_companies'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- =============================================================================
-- Data state (V13–V14)
-- =============================================================================

SELECT
  (SELECT count(*)::bigint FROM public.event_partner_alumni) AS program_count,
  (SELECT count(*)::bigint FROM public.event_partner_alumni_companies) AS draft_member_count,
  (SELECT count(*)::bigint FROM public.event_partner_alumni_snapshots) AS snapshot_count,
  (SELECT count(*)::bigint FROM public.event_partner_alumni_snapshot_companies) AS snapshot_member_count;

SELECT
  (SELECT count(*)::bigint FROM public.event_series) AS event_series_count,
  (SELECT count(*)::bigint FROM public.companies) AS companies_count;

-- =============================================================================
-- Behavioral checks (V15–V16) — rolled back
-- =============================================================================

BEGIN;

DO $preflight$
DECLARE
  v_series_id uuid;
  v_series_id_2 uuid;
  v_company_id uuid;
  v_company_id_2 uuid;
  v_program_id uuid;
  v_snapshot_id uuid;
BEGIN
  SELECT id INTO v_series_id
  FROM public.event_series
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_series_id_2
  FROM public.event_series
  WHERE id <> v_series_id
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_company_id
  FROM public.companies
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_company_id_2
  FROM public.companies
  WHERE id <> v_company_id
  ORDER BY id
  LIMIT 1;

  IF v_series_id IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'VERIFY_SKIP: need at least one event_series and one company for behavioral checks';
  END IF;

  INSERT INTO public.event_partner_alumni (
    id,
    event_series_id,
    recognition_label,
    primary_source_url,
    created_at,
    updated_at
  )
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    v_series_id,
    'Our Partners Over The Years',
    'https://example.com/partners',
    now(),
    now()
  )
  RETURNING id INTO v_program_id;

  -- V16: second program for same series fails
  BEGIN
    INSERT INTO public.event_partner_alumni (event_series_id)
    VALUES (v_series_id);

    RAISE EXCEPTION 'V16_FAIL: duplicate event_series_id should have been rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  INSERT INTO public.event_partner_alumni_companies (
    id,
    event_partner_alumni_id,
    company_id,
    display_order,
    created_at,
    updated_at
  )
  VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    v_program_id,
    v_company_id,
    1,
    now(),
    now()
  );

  -- V15: duplicate draft member fails
  BEGIN
    INSERT INTO public.event_partner_alumni_companies (
      event_partner_alumni_id,
      company_id,
      display_order
    )
    VALUES (v_program_id, v_company_id, 2);

    RAISE EXCEPTION 'V15_FAIL: duplicate program/company should have been rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- CHECK: display_order >= 1 on draft
  IF v_company_id_2 IS NOT NULL THEN
    BEGIN
      INSERT INTO public.event_partner_alumni_companies (
        event_partner_alumni_id,
        company_id,
        display_order
      )
      VALUES (v_program_id, v_company_id_2, 0);

      RAISE EXCEPTION 'CHECK_FAIL: draft display_order < 1 should have been rejected';
    EXCEPTION
      WHEN check_violation THEN
        NULL;
    END;
  END IF;

  -- CHECK: recognition_label max length
  BEGIN
    UPDATE public.event_partner_alumni
    SET recognition_label = repeat('x', 201)
    WHERE id = v_program_id;

    RAISE EXCEPTION 'CHECK_FAIL: recognition_label > 200 should have been rejected';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  INSERT INTO public.event_partner_alumni_snapshots (
    id,
    event_partner_alumni_id,
    recognition_label,
    primary_source_url,
    verified_at,
    created_at
  )
  VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    v_program_id,
    'Our Partners Over The Years',
    'https://example.com/partners',
    now(),
    now()
  )
  RETURNING id INTO v_snapshot_id;

  UPDATE public.event_partner_alumni
  SET latest_snapshot_id = v_snapshot_id
  WHERE id = v_program_id;

  INSERT INTO public.event_partner_alumni_snapshot_companies (
    id,
    event_partner_alumni_snapshot_id,
    company_id,
    display_order
  )
  VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    v_snapshot_id,
    v_company_id,
    1
  );

  -- duplicate snapshot member fails
  BEGIN
    INSERT INTO public.event_partner_alumni_snapshot_companies (
      event_partner_alumni_snapshot_id,
      company_id,
      display_order
    )
    VALUES (v_snapshot_id, v_company_id, 2);

    RAISE EXCEPTION 'CHECK_FAIL: duplicate snapshot member should have been rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- CHECK: display_order >= 1 on snapshot member
  IF v_company_id_2 IS NOT NULL THEN
    BEGIN
      INSERT INTO public.event_partner_alumni_snapshot_companies (
        event_partner_alumni_snapshot_id,
        company_id,
        display_order
      )
      VALUES (v_snapshot_id, v_company_id_2, 0);

      RAISE EXCEPTION 'CHECK_FAIL: snapshot display_order < 1 should have been rejected';
    EXCEPTION
      WHEN check_violation THEN
        NULL;
    END;
  END IF;

  -- DELETE parent series blocked while program exists
  BEGIN
    DELETE FROM public.event_series
    WHERE id = v_series_id;

    RAISE EXCEPTION 'FK_FAIL: delete series with partner alumni program should be restricted';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- DELETE snapshot referenced by latest_snapshot_id blocked
  BEGIN
    DELETE FROM public.event_partner_alumni_snapshots
    WHERE id = v_snapshot_id;

    RAISE EXCEPTION 'FK_FAIL: delete snapshot referenced by latest_snapshot_id should be restricted';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;
END $preflight$;

SELECT 'V15_OK' AS duplicate_draft_member,
       'V16_OK' AS duplicate_series_program,
       'CHECK_OK' AS check_constraints,
       'FK_OK' AS restrict_delete;

ROLLBACK;
