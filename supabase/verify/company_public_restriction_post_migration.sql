-- Company public restriction post-migration verification.
-- Run after applying 20260716120000_company_public_restriction.sql:
--   supabase db query --linked -f supabase/verify/company_public_restriction_post_migration.sql

-- V1: restricted_at column exists
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
  AND column_name = 'restricted_at';

-- V2: CHECK constraint exists
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'companies'
  AND con.conname = 'companies_restricted_active_only';

-- V3: publicly displayable index exists
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'companies'
  AND indexname = 'companies_publicly_displayable_idx';

-- V4: CHECK constraint behavior (uses temp rows; rolls back)
DO $$
DECLARE
  v_active_id uuid;
  v_merged_id uuid;
BEGIN
  -- Pick an existing active company for restrict test
  SELECT id INTO v_active_id
  FROM public.companies
  WHERE status = 'active'::public.company_status
    AND restricted_at IS NULL
  LIMIT 1;

  IF v_active_id IS NULL THEN
    RAISE NOTICE 'SKIP: no active company available for restrict test';
    RETURN;
  END IF;

  -- Active company can be restricted
  UPDATE public.companies
  SET restricted_at = now()
  WHERE id = v_active_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = v_active_id AND restricted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: active company could not be restricted';
  END IF;

  -- Restore for subsequent tests
  UPDATE public.companies
  SET restricted_at = NULL
  WHERE id = v_active_id;

  -- Public active company with restricted_at NULL remains valid (no-op check)
  IF NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = v_active_id
      AND status = 'active'::public.company_status
      AND restricted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: public active company state invalid after restore';
  END IF;

  -- Merged company cannot be restricted
  SELECT id INTO v_merged_id
  FROM public.companies
  WHERE status = 'merged'::public.company_status
    AND restricted_at IS NULL
  LIMIT 1;

  IF v_merged_id IS NULL THEN
    RAISE NOTICE 'SKIP: no merged company available for restrict-block test';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.companies
    SET restricted_at = now()
    WHERE id = v_merged_id;
    RAISE EXCEPTION 'FAIL: merged company restriction should be blocked by CHECK';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  -- Merged company with restricted_at NULL remains valid
  IF NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = v_merged_id
      AND status = 'merged'::public.company_status
      AND restricted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: merged company with NULL restricted_at is invalid';
  END IF;

  RAISE NOTICE 'PASS: companies_restricted_active_only constraint behavior verified';
END $$;

-- V5: event-filter discovery excludes restricted company without hiding unrestricted peers
DO $$
DECLARE
  v_edition_id uuid;
  v_edition_slug text;
  v_company_a uuid;
  v_company_b uuid;
  v_company_c uuid;
  v_result jsonb;
  v_row_ids uuid[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'restricted_at'
  ) THEN
    RAISE NOTICE 'SKIP V5: restricted_at column not present (apply migration first)';
    RETURN;
  END IF;

  SELECT ee.id, ee.slug
    INTO v_edition_id, v_edition_slug
  FROM public.event_editions ee
  INNER JOIN public.event_sponsors es ON es.event_editions_id = ee.id
  INNER JOIN public.companies c ON c.id = es.company_id
  WHERE ee.slug IS NOT NULL
    AND c.status = 'active'::public.company_status
    AND c.restricted_at IS NULL
  GROUP BY ee.id, ee.slug
  HAVING count(DISTINCT es.company_id) >= 3
  ORDER BY ee.slug
  LIMIT 1;

  IF v_edition_id IS NULL THEN
    RAISE NOTICE 'SKIP V5: no edition with 3+ active unrestricted sponsor companies';
    RETURN;
  END IF;

  SELECT ids[1], ids[2], ids[3]
    INTO v_company_a, v_company_b, v_company_c
  FROM (
    SELECT array_agg(company_id ORDER BY company_id) AS ids
    FROM (
      SELECT DISTINCT es.company_id
      FROM public.event_sponsors es
      INNER JOIN public.companies c ON c.id = es.company_id
      WHERE es.event_editions_id = v_edition_id
        AND c.status = 'active'::public.company_status
        AND c.restricted_at IS NULL
      LIMIT 3
    ) picked
  ) triple;

  IF v_company_a IS NULL OR v_company_b IS NULL OR v_company_c IS NULL THEN
    RAISE NOTICE 'SKIP V5: could not pick three companies on edition %', v_edition_slug;
    RETURN;
  END IF;

  UPDATE public.companies
  SET restricted_at = now()
  WHERE id = v_company_b;

  SET LOCAL ROLE authenticated;
  SELECT public.sponsor_discovery_page(NULL, v_edition_slug, 'activity', 1, 5000)
    INTO v_result;
  RESET ROLE;

  SELECT coalesce(array_agg((row_obj ->> 'id')::uuid), '{}'::uuid[])
    INTO v_row_ids
  FROM jsonb_array_elements(coalesce(v_result -> 'rows', '[]'::jsonb)) AS row_obj;

  IF NOT (v_company_a = ANY (v_row_ids)) THEN
    RAISE EXCEPTION 'FAIL V5: unrestricted company A missing from event discovery (edition=%)', v_edition_slug;
  END IF;

  IF v_company_b = ANY (v_row_ids) THEN
    RAISE EXCEPTION 'FAIL V5: restricted company B still appears in event discovery (edition=%)', v_edition_slug;
  END IF;

  IF NOT (v_company_c = ANY (v_row_ids)) THEN
    RAISE EXCEPTION 'FAIL V5: unrestricted company C missing from event discovery (edition=%)', v_edition_slug;
  END IF;

  UPDATE public.companies
  SET restricted_at = NULL
  WHERE id = v_company_b;

  RAISE NOTICE 'PASS V5: event discovery excludes restricted company %, retains peers on edition %',
    v_company_b, v_edition_slug;
END $$;
