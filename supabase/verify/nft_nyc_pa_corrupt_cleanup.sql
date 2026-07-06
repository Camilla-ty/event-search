-- NFT NYC Partner Alumni — corrupt import cleanup (REVIEW ONLY until confirmed)
--
-- Context:
--   Program:  26c56d83-cd31-4a7a-b372-98dcdf041840  (NFT NYC)
--   Version:  7fd89aa6-8a0f-44dd-9b93-e46100bbbb62  (label: test)
--   Problem:  443 members → 443 Jul-5 numeric-name duplicate companies; 0 catalog links
--
-- Does NOT touch: sponsor import, event_sponsors, real catalog companies
-- Does NOT re-import Partner Alumni
--
-- Run preflight section first. Execute cleanup only after counts match expectations.

BEGIN;

-- =============================================================================
-- PREFLIGHT — snapshot counts (read-only; safe to run anytime)
-- =============================================================================

-- Expected before cleanup:
--   current_version_id = 7fd89aa6-8a0f-44dd-9b93-e46100bbbb62
--   version_members    = 443
--   bogus_companies    = 445  (name ~ '^[0-9]+$' on 2026-07-05)

SELECT
  ep.id AS program_id,
  ep.current_version_id,
  es.name AS series_name
FROM public.event_partner_alumni ep
JOIN public.event_series es ON es.id = ep.event_series_id
WHERE ep.id = '26c56d83-cd31-4a7a-b372-98dcdf041840';

SELECT COUNT(*)::int AS version_members
FROM public.event_partner_alumni_version_companies
WHERE event_partner_alumni_version_id = '7fd89aa6-8a0f-44dd-9b93-e46100bbbb62';

SELECT COUNT(*)::int AS bogus_companies
FROM public.companies
WHERE created_at >= '2026-07-05'::date
  AND created_at < '2026-07-06'::date
  AND name ~ '^[0-9]+$';

-- Bogus company references (ALL must be 0 before company delete, except PA members)
WITH bogus AS (
  SELECT id
  FROM public.companies
  WHERE created_at >= '2026-07-05'::date
    AND created_at < '2026-07-06'::date
    AND name ~ '^[0-9]+$'
)
SELECT 'event_sponsors' AS ref_table, COUNT(*)::int AS refs
FROM public.event_sponsors es JOIN bogus b ON b.id = es.company_id
UNION ALL
SELECT 'event_edition_organizers', COUNT(*)::int
FROM public.event_edition_organizers eo JOIN bogus b ON b.id = eo.company_id
UNION ALL
SELECT 'event_partner_alumni_version_companies', COUNT(*)::int
FROM public.event_partner_alumni_version_companies vc JOIN bogus b ON b.id = vc.company_id
UNION ALL
SELECT 'company_domains', COUNT(*)::int
FROM public.company_domains cd JOIN bogus b ON b.id = cd.company_id
UNION ALL
SELECT 'sponsor_import_draft_links', COUNT(*)::int
FROM public.sponsor_import_draft_links sdl JOIN bogus b ON b.id = sdl.company_id
UNION ALL
SELECT 'sponsor_import_rows_proposed', COUNT(*)::int
FROM public.sponsor_import_rows sir JOIN bogus b ON b.id = sir.proposed_company_id
UNION ALL
SELECT 'sponsor_import_rows_resolved', COUNT(*)::int
FROM public.sponsor_import_rows sir JOIN bogus b ON b.id = sir.resolved_company_id
UNION ALL
SELECT 'company_slug_redirects', COUNT(*)::int
FROM public.company_slug_redirects csr JOIN bogus b ON b.id = csr.company_id
UNION ALL
SELECT 'company_merges', COUNT(*)::int
FROM public.company_merges cm
JOIN bogus b ON b.id = cm.canonical_company_id OR b.id = cm.duplicate_company_id
UNION ALL
SELECT 'company_sponsor_stats', COUNT(*)::int
FROM public.company_sponsor_stats css JOIN bogus b ON b.id = css.company_id;

-- Sanity: real catalog companies must still exist (must return 4 rows)
SELECT id, name, domain, created_at
FROM public.companies
WHERE id IN (
  '911c2d26-6942-483b-9dc1-c47cf13f91fa', -- MoonPay
  'f024e025-a14d-4acf-8773-92d955fd534a', -- OpenSea
  '560b1ee0-2435-4184-83cc-283d078d504e', -- Coinbase
  'c2b62910-1a59-42b0-a8ff-249247ad0ffd'  -- Canon
)
ORDER BY name;

-- Sanity: non-bogus Jul-5 companies must NOT match delete predicate (informational)
SELECT id, name, created_at
FROM public.companies
WHERE created_at >= '2026-07-05'::date
  AND created_at < '2026-07-06'::date
  AND name !~ '^[0-9]+$'
ORDER BY created_at;

-- =============================================================================
-- CLEANUP — uncomment and run ONLY after preflight passes and ops confirms
-- =============================================================================

-- Step 1: Hide public Partner Alumni tab (unset current pointer)
-- UPDATE public.event_partner_alumni
-- SET
--   current_version_id = NULL,
--   updated_at = now()
-- WHERE id = '26c56d83-cd31-4a7a-b372-98dcdf041840'
--   AND current_version_id = '7fd89aa6-8a0f-44dd-9b93-e46100bbbb62';

-- Step 2: Remove corrupt version members (443 expected)
-- DELETE FROM public.event_partner_alumni_version_companies
-- WHERE event_partner_alumni_version_id = '7fd89aa6-8a0f-44dd-9b93-e46100bbbb62';

-- Step 3: Delete corrupt version (safe after step 1 + 2; ON DELETE RESTRICT on current_version_id)
-- DELETE FROM public.event_partner_alumni_versions
-- WHERE id = '7fd89aa6-8a0f-44dd-9b93-e46100bbbb62'
--   AND event_partner_alumni_id = '26c56d83-cd31-4a7a-b372-98dcdf041840';

-- Step 4: Delete bogus numeric-name companies (445 expected)
-- Abort if any bogus row still has non-PA references:
-- DO $$
-- DECLARE
--   v_blockers int;
-- BEGIN
--   WITH bogus AS (
--     SELECT id FROM public.companies
--     WHERE created_at >= '2026-07-05'::date
--       AND created_at < '2026-07-06'::date
--       AND name ~ '^[0-9]+$'
--   )
--   SELECT COUNT(*) INTO v_blockers
--   FROM (
--     SELECT 1 FROM public.event_sponsors es JOIN bogus b ON b.id = es.company_id
--     UNION ALL
--     SELECT 1 FROM public.event_edition_organizers eo JOIN bogus b ON b.id = eo.company_id
--     UNION ALL
--     SELECT 1 FROM public.event_partner_alumni_version_companies vc JOIN bogus b ON b.id = vc.company_id
--     UNION ALL
--     SELECT 1 FROM public.company_domains cd JOIN bogus b ON b.id = cd.company_id
--     UNION ALL
--     SELECT 1 FROM public.sponsor_import_draft_links sdl JOIN bogus b ON b.id = sdl.company_id
--     UNION ALL
--     SELECT 1 FROM public.sponsor_import_rows sir JOIN bogus b ON b.id = sir.proposed_company_id
--     UNION ALL
--     SELECT 1 FROM public.sponsor_import_rows sir JOIN bogus b ON b.id = sir.resolved_company_id
--     UNION ALL
--     SELECT 1 FROM public.company_slug_redirects csr JOIN bogus b ON b.id = csr.company_id
--     UNION ALL
--     SELECT 1 FROM public.company_merges cm
--       JOIN bogus b ON b.id = cm.canonical_company_id OR b.id = cm.duplicate_company_id
--     UNION ALL
--     SELECT 1 FROM public.company_sponsor_stats css JOIN bogus b ON b.id = css.company_id
--   ) blockers;
--
--   IF v_blockers > 0 THEN
--     RAISE EXCEPTION 'Refusing to delete bogus companies: % blocking references remain', v_blockers;
--   END IF;
-- END $$;
--
-- DELETE FROM public.companies
-- WHERE created_at >= '2026-07-05'::date
--   AND created_at < '2026-07-06'::date
--   AND name ~ '^[0-9]+$';

-- =============================================================================
-- POSTFLIGHT — expected after successful cleanup
-- =============================================================================

-- SELECT ep.current_version_id FROM public.event_partner_alumni ep
-- WHERE ep.id = '26c56d83-cd31-4a7a-b372-98dcdf041840';
-- -- expected: NULL
--
-- SELECT COUNT(*)::int AS version_members FROM public.event_partner_alumni_version_companies
-- WHERE event_partner_alumni_version_id = '7fd89aa6-8a0f-44dd-9b93-e46100bbbb62';
-- -- expected: 0
--
-- SELECT COUNT(*)::int AS bogus_remaining FROM public.companies
-- WHERE created_at >= '2026-07-05'::date AND created_at < '2026-07-06'::date AND name ~ '^[0-9]+$';
-- -- expected: 0
--
-- SELECT id, name FROM public.companies
-- WHERE id IN (
--   '911c2d26-6942-483b-9dc1-c47cf13f91fa',
--   'f024e025-a14d-4acf-8773-92d955fd534a',
--   '560b1ee0-2435-4184-83cc-283d078d504e',
--   'c2b62910-1a59-42b0-a8ff-249247ad0ffd'
-- );
-- -- expected: MoonPay, OpenSea, Coinbase, Canon unchanged

ROLLBACK;
