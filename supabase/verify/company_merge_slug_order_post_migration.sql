-- Company merge slug-order fix post-migration verification.
-- Run after applying 20260626120000_company_merge_slug_order_fix.sql:
--   supabase db query --linked -f supabase/verify/company_merge_slug_order_post_migration.sql

-- V1: tombstone slug helper exists
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = '_company_merge_tombstone_slug';

-- V2: merge_companies still present with Phase 2 signature
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'merge_companies';

-- -----------------------------------------------------------------------------
-- S8: Slug-order smoke (transaction rolled back; not CKMA/ČKMA)
-- Canonical adopts duplicate slug when field_resolutions.slug = duplicate.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_canonical_id uuid := gen_random_uuid();
  v_duplicate_id uuid := gen_random_uuid();
  v_performer uuid;
  v_winner_slug text := 'merge-qa-winner-' || left(replace(v_duplicate_id::text, '-', ''), 8);
  v_loser_slug text := 'merge-qa-loser-' || left(replace(v_canonical_id::text, '-', ''), 8);
  v_canonical_slug text;
  v_duplicate_slug text;
  v_redirect_count integer;
  v_tombstone_slug text;
BEGIN
  SELECT id INTO v_performer FROM public.profiles LIMIT 1;
  IF v_performer IS NULL THEN
    RAISE EXCEPTION 'S8 SKIP: no profile row available for performed_by';
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
      'Merge Slug QA Canonical',
      v_loser_slug,
      'active'::public.company_status,
      'https://merge-qa-canonical.example',
      'merge-qa-canonical.example'
    ),
    (
      v_duplicate_id,
      'Merge Slug QA Duplicate',
      v_winner_slug,
      'active'::public.company_status,
      'https://merge-qa-duplicate.example',
      'merge-qa-duplicate.example'
    );

  v_tombstone_slug := public._company_merge_tombstone_slug(v_duplicate_id);

  PERFORM public.merge_companies(
    v_canonical_id,
    v_duplicate_id,
    v_performer,
    jsonb_build_object(
      'schema_version', 2,
      'sponsorship_conflicts', '[]'::jsonb,
      'draft_link_conflicts', '[]'::jsonb,
      'field_resolutions', jsonb_build_object(
        'slug', 'duplicate',
        'domain', 'canonical',
        'website', 'canonical',
        'logo', 'best_available'
      )
    ),
    'slug-order-verify'
  );

  SELECT slug INTO v_canonical_slug FROM public.companies WHERE id = v_canonical_id;
  SELECT slug INTO v_duplicate_slug FROM public.companies WHERE id = v_duplicate_id;

  IF v_canonical_slug IS DISTINCT FROM v_winner_slug THEN
    RAISE EXCEPTION 'S8 FAIL: canonical slug expected %, got %', v_winner_slug, v_canonical_slug;
  END IF;

  IF v_duplicate_slug IS DISTINCT FROM v_tombstone_slug THEN
    RAISE EXCEPTION 'S8 FAIL: duplicate tombstone slug expected %, got %', v_tombstone_slug, v_duplicate_slug;
  END IF;

  SELECT COUNT(*)::integer
  INTO v_redirect_count
  FROM public.company_slug_redirects
  WHERE slug = v_loser_slug
    AND company_id = v_canonical_id;

  IF v_redirect_count <> 1 THEN
    RAISE EXCEPTION 'S8 FAIL: expected one slug redirect for %, found %', v_loser_slug, v_redirect_count;
  END IF;

  RAISE EXCEPTION 'S8 ROLLBACK';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'S8 ROLLBACK' THEN
      RAISE NOTICE 'S8 slug-order smoke test passed (rolled back)';
    ELSE
      RAISE;
    END IF;
END;
$$;
