/*
  RLS verification — run after applying migration 20260514180000_rls_tiered_sponsors_public_reads.sql

  =============================================================================
  TEST CHECKLIST (manual via Supabase REST or this app)
  =============================================================================

  Anon (use anon key, no Authorization user JWT)
  - [ ] SELECT event_editions / event_series succeeds (public events).
  - [ ] SELECT companies succeeds (fully public).
  - [ ] SELECT event_sponsors returns ONLY rows with tier_rank = 1.
  - [ ] INSERT/UPDATE/DELETE on event_sponsors, companies, event_editions, event_series FAIL.

  Authenticated (valid logged-in session JWT; email confirmation not required)
  - [ ] SELECT event_sponsors returns ALL tier_rank values (1 and 2+).
  - [ ] SELECT companies / event_editions / event_series still succeeds.
  - [ ] INSERT/UPDATE/DELETE on those four tables FAIL.

  Service role (server admin only — never in browser)
  - [ ] Writes to event_sponsors, companies, event_editions, event_series still succeed.

  =============================================================================
  BASELINE QUERIES (run in SQL Editor as postgres / service_role — sees all rows)
  =============================================================================
*/

-- Row counts for comparison with anon vs authenticated API results
SELECT 'event_sponsors_total' AS label, count(*)::bigint AS n FROM public.event_sponsors
UNION ALL
SELECT 'event_sponsors_tier_rank_1', count(*)::bigint FROM public.event_sponsors WHERE tier_rank = 1
UNION ALL
SELECT 'event_sponsors_tier_rank_ge_2', count(*)::bigint FROM public.event_sponsors WHERE tier_rank >= 2;

-- ---------------------------------------------------------------------------
-- Optional: exercise RLS inside Postgres using role switch (may require
-- membership: GRANT anon TO postgres; GRANT authenticated TO postgres;)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- SET LOCAL ROLE anon;
-- SELECT count(*) AS anon_event_sponsors_visible FROM public.event_sponsors;
-- ROLLBACK;
--
-- BEGIN;
-- SET LOCAL ROLE authenticated;
-- SELECT count(*) AS authenticated_event_sponsors_visible FROM public.event_sponsors;
-- ROLLBACK;
