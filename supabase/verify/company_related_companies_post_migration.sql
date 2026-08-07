-- Related Companies V1 Phase 2 post-migration verification.
-- Run after applying 20260807130000_company_related_companies.sql:
--   supabase db query --linked -f supabase/verify/company_related_companies_post_migration.sql

-- V1: table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'company_related_companies';

-- V2: expected columns only (no type / note / created_by in V1)
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'company_related_companies'
ORDER BY ordinal_position;

-- V3: indexes and unique pair
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'company_related_companies'
ORDER BY indexname;

-- V4: check constraints (distinct + ordered)
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.company_related_companies'::regclass
  AND contype = 'c'
ORDER BY conname;

-- V5: FKs ON DELETE RESTRICT
SELECT
  a.attname AS column_name,
  confrelid::regclass AS target,
  CASE c.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete
FROM pg_constraint c
JOIN lateral unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ck.attnum
WHERE c.contype = 'f'
  AND c.conrelid = 'public.company_related_companies'::regclass
ORDER BY a.attname;

-- V6: RLS enabled
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'company_related_companies';

-- V7: no policies (service_role via grants; expect 0 rows)
SELECT c.relname AS table_name, p.polname
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'company_related_companies';

-- V8: anon/authenticated have no grants
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'company_related_companies'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee;

-- V9: ordered unique insert / reject reverse and self (transaction rolled back)
DO $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_id uuid;
BEGIN
  SELECT c1.id, c2.id
  INTO v_a, v_b
  FROM public.companies c1
  JOIN public.companies c2 ON c1.id < c2.id
  WHERE c1.status = 'active'::public.company_status
    AND c2.status = 'active'::public.company_status
  LIMIT 1;

  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE NOTICE 'V9 skipped: need two active companies';
    RETURN;
  END IF;

  INSERT INTO public.company_related_companies (company_a_id, company_b_id)
  VALUES (v_a, v_b)
  RETURNING id INTO v_id;

  BEGIN
    INSERT INTO public.company_related_companies (company_a_id, company_b_id)
    VALUES (v_b, v_a);
    RAISE EXCEPTION 'V9 failed: reverse pair should violate ordered CHECK';
  EXCEPTION
    WHEN check_violation THEN
      NULL; -- expected
  END;

  BEGIN
    INSERT INTO public.company_related_companies (company_a_id, company_b_id)
    VALUES (v_a, v_a);
    RAISE EXCEPTION 'V9 failed: self pair should violate distinct CHECK';
  EXCEPTION
    WHEN check_violation THEN
      NULL; -- expected
  END;

  DELETE FROM public.company_related_companies WHERE id = v_id;
  RAISE NOTICE 'V9 ok: ordered pair + rejects reverse/self';
END $$;
