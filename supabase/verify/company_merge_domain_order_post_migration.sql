-- Company merge domain-order fix post-migration verification.
-- Run after applying 20260627120000_company_merge_domain_order_fix.sql:
--   supabase db query --linked -f supabase/verify/company_merge_domain_order_post_migration.sql

-- V1: merge_companies present
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'merge_companies';

-- -----------------------------------------------------------------------------
-- S9: Domain-order smoke (transaction rolled back; not CKMA/ČKMA)
-- Canonical adopts duplicate domain when field_resolutions.domain = duplicate.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_canonical_id uuid := gen_random_uuid();
  v_duplicate_id uuid := gen_random_uuid();
  v_performer uuid;
  v_winner_domain text := 'merge-qa-domain-' || left(replace(v_duplicate_id::text, '-', ''), 8) || '.example';
  v_loser_domain text := 'merge-qa-loser-' || left(replace(v_canonical_id::text, '-', ''), 8) || '.example';
  v_canonical_domain text;
  v_duplicate_domain text;
BEGIN
  SELECT id INTO v_performer FROM public.profiles LIMIT 1;
  IF v_performer IS NULL THEN
    RAISE EXCEPTION 'S9 SKIP: no profile row available for performed_by';
  END IF;

  INSERT INTO public.companies (
    id,
    name,
    slug,
    status,
    website,
    domain
  )
  VALUES
    (
      v_canonical_id,
      'Merge Domain QA Canonical',
      'merge-domain-qa-canonical-' || left(replace(v_canonical_id::text, '-', ''), 8),
      'active'::public.company_status,
      'https://' || v_loser_domain,
      v_loser_domain
    ),
    (
      v_duplicate_id,
      'Merge Domain QA Duplicate',
      'merge-domain-qa-duplicate-' || left(replace(v_duplicate_id::text, '-', ''), 8),
      'active'::public.company_status,
      'https://' || v_winner_domain,
      v_winner_domain
    );

  PERFORM public.merge_companies(
    v_canonical_id,
    v_duplicate_id,
    v_performer,
    jsonb_build_object(
      'schema_version', 2,
      'sponsorship_conflicts', '[]'::jsonb,
      'draft_link_conflicts', '[]'::jsonb,
      'field_resolutions', jsonb_build_object(
        'slug', 'canonical',
        'domain', 'duplicate',
        'website', 'canonical',
        'logo', 'best_available',
        'short_description', 'longer',
        'description', 'longer'
      )
    ),
    'domain-order-verify'
  );

  SELECT domain INTO v_canonical_domain FROM public.companies WHERE id = v_canonical_id;
  SELECT domain INTO v_duplicate_domain FROM public.companies WHERE id = v_duplicate_id;

  IF v_canonical_domain IS DISTINCT FROM v_winner_domain THEN
    RAISE EXCEPTION 'S9 FAIL: canonical domain expected %, got %', v_winner_domain, v_canonical_domain;
  END IF;

  IF v_duplicate_domain IS NOT NULL THEN
    RAISE EXCEPTION 'S9 FAIL: duplicate domain expected NULL, got %', v_duplicate_domain;
  END IF;

  RAISE EXCEPTION 'S9 ROLLBACK';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'S9 ROLLBACK' THEN
      RAISE NOTICE 'S9 domain-order smoke test passed (rolled back)';
    ELSE
      RAISE;
    END IF;
END;
$$;
