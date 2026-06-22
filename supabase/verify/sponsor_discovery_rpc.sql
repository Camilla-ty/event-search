/*
  Sponsor discovery RPC verification
  Run after migrations:
    - 20260622120000_sponsor_discovery_page_rpc.sql
    - 20260623120000_sponsor_discovery_visibility_pr1_1.sql

  Run in Supabase SQL Editor as postgres / service_role unless noted.

  =============================================================================
  CHECKLIST (PR1.1 visibility model)
  =============================================================================

  Schema
  - [ ] View public.company_sponsor_stats exists (security_invoker = false)
  - [ ] Function public.sponsor_discovery_page exists (SECURITY INVOKER)
  - [ ] EXECUTE granted to anon and authenticated on RPC
  - [ ] SELECT granted to anon and authenticated on company_sponsor_stats
  - [ ] Index event_sponsors_company_id_idx exists

  Global discovery (p_event_slug IS NULL)
  - [ ] company_sponsor_stats row count = COUNT(DISTINCT company_id) from event_sponsors
  - [ ] RPC global total matches company_sponsor_stats count
  - [ ] anon global total = authenticated global total (same eligibility)

  Event-filter discovery (p_event_slug set)
  - [ ] Uses RLS: anon event-filter total <= authenticated (when tier 2+ exist on edition)
  - [ ] tier fields populated on rows when event filter active

  Contract
  - [ ] Default call returns rows[], total, page, page_size, sort, event_unknown, event
  - [ ] sort=tier without event coerces to activity
  - [ ] Unknown event slug → event_unknown=true, total=0

  =============================================================================
  V1 — Function + view metadata
  =============================================================================
*/

SELECT
  c.relname AS relation_name,
  c.relkind AS kind,
  c.reloptions AS options
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'company_sponsor_stats';

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'sponsor_discovery_page';

-- Expect security_definer = false on sponsor_discovery_page

SELECT
  has_table_privilege('anon', 'public.company_sponsor_stats', 'SELECT') AS anon_stats_select,
  has_table_privilege('authenticated', 'public.company_sponsor_stats', 'SELECT') AS auth_stats_select,
  has_function_privilege('anon', 'public.sponsor_discovery_page(text, text, text, integer, integer)', 'EXECUTE')
    AS anon_rpc_execute,
  has_function_privilege('authenticated', 'public.sponsor_discovery_page(text, text, text, integer, integer)', 'EXECUTE')
    AS auth_rpc_execute;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'event_sponsors'
  AND indexname = 'event_sponsors_company_id_idx';

-- =============================================================================
-- V2 — company_sponsor_stats baseline (all tiers, bypasses RLS via view owner)
-- =============================================================================

SELECT count(*)::bigint AS stats_view_companies
FROM public.company_sponsor_stats;

SELECT count(DISTINCT es.company_id)::bigint AS distinct_sponsored_companies
FROM public.event_sponsors es;

-- Expect stats_view_companies = distinct_sponsored_companies

-- =============================================================================
-- V3 — Global RPC total matches stats view
-- =============================================================================

SELECT
  (SELECT count(*)::bigint FROM public.company_sponsor_stats) AS stats_total,
  (
    SELECT (public.sponsor_discovery_page(NULL, NULL, 'activity', 1, 5000) ->> 'total')::bigint
  ) AS global_rpc_total;

-- =============================================================================
-- V4 — Global contract keys
-- =============================================================================

SELECT
  (result ? 'rows') AS has_rows,
  (result ? 'total') AS has_total,
  (result ->> 'sort') AS effective_sort,
  (result ->> 'event_unknown') AS event_unknown,
  (result ->> 'total') AS total,
  jsonb_array_length(result -> 'rows') AS row_count,
  (result -> 'rows' -> 0 ->> 'tier_rank') AS first_row_tier_rank,
  (result -> 'rows' -> 0 ->> 'tier_label') AS first_row_tier_label
FROM (
  SELECT public.sponsor_discovery_page(NULL, NULL, 'activity', 1, 20) AS result
) s;

-- Expect event_unknown=false; global rows should have null tier fields

-- =============================================================================
-- V5 — Sort coercion + unknown event
-- =============================================================================

SELECT (public.sponsor_discovery_page(NULL, NULL, 'tier', 1, 20) ->> 'sort') AS coerced_sort;

SELECT
  (result ->> 'event_unknown') AS event_unknown,
  (result ->> 'total') AS total,
  result -> 'event' AS event_payload
FROM (
  SELECT public.sponsor_discovery_page(
    NULL,
    '__no_such_edition_slug__',
    'activity',
    1,
    20
  ) AS result
) s;

-- =============================================================================
-- V6 — Event-filter sample (pick a real edition slug with sponsors)
-- =============================================================================

WITH sample_edition AS (
  SELECT ee.slug
  FROM public.event_editions ee
  INNER JOIN public.event_sponsors es ON es.event_editions_id = ee.id
  WHERE ee.slug IS NOT NULL
    AND trim(ee.slug) <> ''
  GROUP BY ee.slug
  HAVING count(*) FILTER (WHERE es.tier_rank = 1) > 0
     AND count(*) FILTER (WHERE es.tier_rank >= 2) > 0
  LIMIT 1
)
SELECT
  se.slug AS edition_slug,
  (
    SELECT (public.sponsor_discovery_page(NULL, se.slug, 'tier', 1, 5000) ->> 'total')::bigint
  ) AS rpc_event_total_service_role,
  (
    SELECT count(DISTINCT es.company_id)::bigint
    FROM public.event_sponsors es
    INNER JOIN public.event_editions ee ON ee.id = es.event_editions_id
    WHERE ee.slug = se.slug
  ) AS all_tier_companies_on_edition
FROM sample_edition se;

-- service_role RPC event total should equal all_tier when invoked as superuser

-- =============================================================================
-- V7 — Global anon vs authenticated totals (role switch)
-- Requires: GRANT anon, authenticated TO current_user; or run in SQL editor as postgres
-- =============================================================================

DO $$
DECLARE
  anon_total bigint;
  auth_total bigint;
  stats_total bigint;
BEGIN
  SELECT count(*) INTO stats_total FROM public.company_sponsor_stats;

  SET LOCAL ROLE anon;
  SELECT (public.sponsor_discovery_page(NULL, NULL, 'activity', 1, 5000) ->> 'total')::bigint
    INTO anon_total;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  SELECT (public.sponsor_discovery_page(NULL, NULL, 'activity', 1, 5000) ->> 'total')::bigint
    INTO auth_total;
  RESET ROLE;

  RAISE NOTICE 'stats_total=%, anon_global_total=%, auth_global_total=%',
    stats_total, anon_total, auth_total;

  IF anon_total IS DISTINCT FROM auth_total THEN
    RAISE EXCEPTION 'Global anon/auth totals differ: anon=% auth=%', anon_total, auth_total;
  END IF;

  IF anon_total IS DISTINCT FROM stats_total THEN
    RAISE EXCEPTION 'Global anon total != stats view: anon=% stats=%', anon_total, stats_total;
  END IF;
END $$;

-- =============================================================================
-- V8 — Event-filter anon tier gate (role switch)
-- =============================================================================

DO $$
DECLARE
  v_slug text;
  anon_event_total bigint;
  auth_event_total bigint;
  anon_tier1_total bigint;
BEGIN
  SELECT ee.slug
    INTO v_slug
  FROM public.event_editions ee
  INNER JOIN public.event_sponsors es ON es.event_editions_id = ee.id
  WHERE ee.slug IS NOT NULL
  GROUP BY ee.slug
  HAVING count(*) FILTER (WHERE es.tier_rank >= 2) > 0
  LIMIT 1;

  IF v_slug IS NULL THEN
    RAISE NOTICE 'Skip event tier gate: no edition with tier 2+ sponsors';
    RETURN;
  END IF;

  SELECT count(DISTINCT es.company_id)
    INTO anon_tier1_total
  FROM public.event_sponsors es
  INNER JOIN public.event_editions ee ON ee.id = es.event_editions_id
  WHERE ee.slug = v_slug
    AND es.tier_rank = 1;

  SET LOCAL ROLE anon;
  SELECT (public.sponsor_discovery_page(NULL, v_slug, 'activity', 1, 5000) ->> 'total')::bigint
    INTO anon_event_total;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  SELECT (public.sponsor_discovery_page(NULL, v_slug, 'activity', 1, 5000) ->> 'total')::bigint
    INTO auth_event_total;
  RESET ROLE;

  RAISE NOTICE 'edition=%, anon_event_total=%, auth_event_total=%, tier1_baseline=%',
    v_slug, anon_event_total, auth_event_total, anon_tier1_total;

  IF anon_event_total IS DISTINCT FROM anon_tier1_total THEN
    RAISE EXCEPTION 'Anon event total (%) != tier-1 baseline (%)', anon_event_total, anon_tier1_total;
  END IF;

  IF auth_event_total < anon_event_total THEN
    RAISE EXCEPTION 'Authenticated event total (%) < anon (%)', auth_event_total, anon_event_total;
  END IF;
END $$;

-- =============================================================================
-- V9 — EXPLAIN ANALYZE (global discovery)
-- =============================================================================

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT public.sponsor_discovery_page(NULL, NULL, 'activity', 1, 20);
