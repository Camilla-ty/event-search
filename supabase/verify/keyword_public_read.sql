/*
  Keyword public-read verification — run after Phase 2A.1 preflight.

  Purpose:
  Confirm anon/authenticated clients can read keyword data needed for public
  Topics chips (series keywords inherited on event detail + series hub).

  Automated check (recommended):
    npx tsx --env-file=.env.local scripts/verify-keyword-public-read.ts

  =============================================================================
  MANUAL REST CHECKLIST (anon key, no user JWT)
  =============================================================================

  - [ ] SELECT keyword (id, name, slug) succeeds
  - [ ] SELECT event_series_keyword (series_id, keyword_id) succeeds
  - [ ] SELECT event_series_keyword with embed keyword(id, name, slug) succeeds
  - [ ] Filter by series_id returns embedded keyword rows
  - [ ] INSERT/UPDATE/DELETE on keyword FAIL
  - [ ] INSERT/UPDATE/DELETE on event_series_keyword FAIL

  =============================================================================
  BASELINE (postgres / service_role in SQL Editor)
  =============================================================================
*/

SELECT 'keyword_total' AS label, count(*)::bigint AS n FROM public.keyword
UNION ALL
SELECT 'event_series_keyword_total', count(*)::bigint FROM public.event_series_keyword;

-- Sample join (service_role sees all rows)
SELECT
  esk.series_id,
  k.id,
  k.name,
  k.slug
FROM public.event_series_keyword esk
JOIN public.keyword k ON k.id = esk.keyword_id
ORDER BY k.name
LIMIT 10;

/*
  =============================================================================
  IF ANON REST CHECKS FAIL — apply this migration (idempotent)
  =============================================================================

  File suggestion: supabase/migrations/20260622120000_keyword_public_select_rls.sql

  -- keyword: public SELECT; writes via service_role only
  ALTER TABLE public.keyword ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "keyword_select_anon_all" ON public.keyword;
  DROP POLICY IF EXISTS "keyword_select_authenticated_all" ON public.keyword;

  CREATE POLICY "keyword_select_anon_all"
    ON public.keyword
    FOR SELECT
    TO anon
    USING (true);

  CREATE POLICY "keyword_select_authenticated_all"
    ON public.keyword
    FOR SELECT
    TO authenticated
    USING (true);

  REVOKE ALL ON TABLE public.keyword FROM anon, authenticated;
  GRANT SELECT ON TABLE public.keyword TO anon, authenticated;
  GRANT ALL ON TABLE public.keyword TO service_role;

  event_series_keyword public SELECT is defined in:
  supabase/migrations/20260613120000_event_series_keyword.sql
*/
