-- Post-migration verification for organizers v1 (V1–V12)
-- Run after applying 20260708120000_organizers_v1.sql:
--   supabase db query --linked -f supabase/verify/organizers_v1_post_migration.sql
--
-- Catalog checks (V1–V7, V8–V9) are read-only SELECTs.
-- Behavioral checks (V10–V12, CHECK constraints) run in a transaction and roll back.

-- =============================================================================
-- Schema (V1–V5, V5b)
-- =============================================================================

-- V1: table exists with approved columns
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_edition_organizers'
  AND column_name IN (
    'id',
    'event_editions_id',
    'company_id',
    'role_label',
    'display_order',
    'created_at',
    'updated_at'
  )
ORDER BY column_name;

-- V2: primary key on id
SELECT tc.constraint_name, kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'event_edition_organizers'
  AND tc.constraint_type = 'PRIMARY KEY';

-- V3: FKs with ON DELETE RESTRICT
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint AS c
JOIN pg_class AS rel ON rel.oid = c.conrelid
JOIN pg_namespace AS n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND rel.relname = 'event_edition_organizers'
  AND c.contype = 'f'
ORDER BY c.conname;

-- V4: UNIQUE (event_editions_id, company_id)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'event_edition_organizers'
  AND indexname = 'event_edition_organizers_edition_company_unique';

-- V5: list-order and company indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'event_edition_organizers'
  AND indexname IN (
    'event_edition_organizers_edition_order_idx',
    'event_edition_organizers_company_id_idx'
  )
ORDER BY indexname;

-- V5b: required CHECK constraints
SELECT c.conname AS constraint_name, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint AS c
JOIN pg_class AS rel ON rel.oid = c.conrelid
JOIN pg_namespace AS n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND rel.relname = 'event_edition_organizers'
  AND c.contype = 'c'
ORDER BY c.conname;

-- =============================================================================
-- RLS (V6–V7)
-- =============================================================================

-- V6: RLS enabled; SELECT policies for anon + authenticated
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'event_edition_organizers';

SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'event_edition_organizers'
ORDER BY policyname;

-- V7: grants — anon/authenticated should have SELECT only
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'event_edition_organizers'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- =============================================================================
-- Data state (V8–V9)
-- =============================================================================

-- V8: zero rows immediately after migration apply (informational on fresh apply)
SELECT count(*)::bigint AS organizer_row_count
FROM public.event_edition_organizers;

-- V9: parent tables still readable (baseline sanity)
SELECT
  (SELECT count(*)::bigint FROM public.event_editions) AS event_editions_count,
  (SELECT count(*)::bigint FROM public.companies) AS companies_count;

-- =============================================================================
-- Behavioral checks (V10–V12) — rolled back
-- =============================================================================

BEGIN;

DO $preflight$
DECLARE
  v_edition_id uuid;
  v_company_id uuid;
  v_company_id_2 uuid;
BEGIN
  SELECT id INTO v_edition_id
  FROM public.event_editions
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

  IF v_edition_id IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'VERIFY_SKIP: need at least one event_edition and one company for behavioral checks';
  END IF;

  -- Valid insert for downstream checks
  INSERT INTO public.event_edition_organizers (
    id,
    event_editions_id,
    company_id,
    role_label,
    display_order,
    created_at,
    updated_at
  )
  VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    v_edition_id,
    v_company_id,
    'Organizer',
    1,
    now(),
    now()
  );

  -- V10: duplicate (event_editions_id, company_id) fails
  BEGIN
    INSERT INTO public.event_edition_organizers (
      event_editions_id,
      company_id,
      role_label,
      display_order
    )
    VALUES (v_edition_id, v_company_id, 'Organizer', 2);

    RAISE EXCEPTION 'V10_FAIL: duplicate edition/company should have been rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- V11: invalid FK fails
  BEGIN
    INSERT INTO public.event_edition_organizers (
      event_editions_id,
      company_id,
      role_label,
      display_order
    )
    VALUES (
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      v_company_id,
      'Organizer',
      1
    );

    RAISE EXCEPTION 'V11_FAIL: invalid event_editions_id should have been rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- CHECK: empty role_label after trim
  IF v_company_id_2 IS NOT NULL THEN
    BEGIN
      INSERT INTO public.event_edition_organizers (
        event_editions_id,
        company_id,
        role_label,
        display_order
      )
      VALUES (v_edition_id, v_company_id_2, '   ', 1);

      RAISE EXCEPTION 'CHECK_FAIL: whitespace role_label should have been rejected';
    EXCEPTION
      WHEN check_violation THEN
        NULL;
    END;
  END IF;

  -- CHECK: role_label max length
  IF v_company_id_2 IS NOT NULL THEN
    BEGIN
      INSERT INTO public.event_edition_organizers (
        event_editions_id,
        company_id,
        role_label,
        display_order
      )
      VALUES (
        v_edition_id,
        v_company_id_2,
        repeat('x', 81),
        1
      );

      RAISE EXCEPTION 'CHECK_FAIL: role_label > 80 should have been rejected';
    EXCEPTION
      WHEN check_violation THEN
        NULL;
    END;
  END IF;

  -- CHECK: display_order >= 1
  IF v_company_id_2 IS NOT NULL THEN
    BEGIN
      INSERT INTO public.event_edition_organizers (
        event_editions_id,
        company_id,
        role_label,
        display_order
      )
      VALUES (v_edition_id, v_company_id_2, 'Co-organizer', 0);

      RAISE EXCEPTION 'CHECK_FAIL: display_order < 1 should have been rejected';
    EXCEPTION
      WHEN check_violation THEN
        NULL;
    END;
  END IF;

  -- V12: DELETE parent edition blocked while organizer rows exist
  BEGIN
    DELETE FROM public.event_editions
    WHERE id = v_edition_id;

    RAISE EXCEPTION 'V12_FAIL: delete edition with organizer rows should be restricted';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;
END $preflight$;

SELECT 'V10_OK' AS unique_violation,
       'V11_OK' AS invalid_fk,
       'V12_OK' AS edition_delete_restrict,
       'CHECK_OK' AS check_constraints;

ROLLBACK;
