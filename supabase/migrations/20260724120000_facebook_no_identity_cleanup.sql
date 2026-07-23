-- Facebook website identity cleanup (ADR-002): Facebook hosts are always
-- no_identity. Preserve companies.website; clear invalid companies.domain and
-- matching company_domains rows; unwind open sponsor-import domain matches.
-- Does not modify terminal Partner Alumni import rows.
--
-- Pre-migration audit (remote, 2026-07-23):
--   companies with Facebook identity domain:           17 (all active; all have website)
--     of which facebook.com/profile.php:                1
--   company_domains Facebook rows:                     69 (6 primary, 63 non-primary)
--   open sponsor_import_rows with Facebook domain:      4 (batch status = review)
--   partner_alumni_import_rows with Facebook domain:    2 (terminal imported batches — left alone)
--   conflicts: 1 company (Beacontek) had companies.domain = beaconminer.com while
--     primary company_domains was a Facebook /people/… path — restore primary after delete.
--   no multi-company collisions on the same Facebook domain key.
--
-- Step 3 (primary restore / backfill) — intentional scope beyond Facebook-only:
--   * Restores a primary company_domains row after Facebook-primary removal when
--     companies.domain remains a non-Facebook identity (Beacontek repair).
--   * Also globally backfills missing primary company_domains rows for any company
--     that already has a non-null non-Facebook companies.domain but no primary row
--     (historical invariant gap: Phase 2 backfill + createCompany sync landed later).
--   * Preserves all existing non-Facebook company_domains rows (no updates/deletes
--     of those rows); only inserts new primary rows or promotes an existing
--     non-primary row that already matches companies.domain.
--   * Production run inserted 1,592 primary rows:
--       1 Beacontek repair + 1,591 historical invariant-gap repairs.

-- -----------------------------------------------------------------------------
-- Helpers: Facebook identity keys stored as companies.domain / company_domains.domain
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE tmp_facebook_identity_domains ON COMMIT DROP AS
SELECT id AS company_id, domain AS old_domain, website
FROM public.companies
WHERE domain IS NOT NULL
  AND (
    lower(trim(domain)) IN ('facebook.com', 'fb.com', 'm.facebook.com')
    OR lower(trim(domain)) LIKE 'facebook.com/%'
    OR lower(trim(domain)) LIKE 'fb.com/%'
    OR lower(trim(domain)) LIKE 'm.facebook.com/%'
  );

CREATE TEMP TABLE tmp_facebook_company_domain_rows ON COMMIT DROP AS
SELECT id, company_id, domain, is_primary
FROM public.company_domains
WHERE lower(trim(domain)) IN ('facebook.com', 'fb.com', 'm.facebook.com')
   OR lower(trim(domain)) LIKE 'facebook.com/%'
   OR lower(trim(domain)) LIKE 'fb.com/%'
   OR lower(trim(domain)) LIKE 'm.facebook.com/%';

-- -----------------------------------------------------------------------------
-- 1) Clear companies.domain for Facebook-derived identities (website unchanged)
-- -----------------------------------------------------------------------------

UPDATE public.companies c
SET domain = NULL
FROM tmp_facebook_identity_domains t
WHERE c.id = t.company_id;

-- -----------------------------------------------------------------------------
-- 2) Delete Facebook company_domains rows (primary and non-primary)
-- -----------------------------------------------------------------------------

DELETE FROM public.company_domains cd
USING tmp_facebook_company_domain_rows t
WHERE cd.id = t.id;

-- -----------------------------------------------------------------------------
-- 3) Restore / backfill primary company_domains for non-null companies.domain
--
-- After deleting Facebook company_domains rows, companies that only had a
-- Facebook primary need a primary restored when companies.domain is still a
-- non-Facebook identity (Beacontek: companies.domain = beaconminer.com).
--
-- The same statements also globally backfill any other company that already has
-- a non-null non-Facebook companies.domain but no primary company_domains row.
-- Existing non-Facebook company_domains rows are preserved. Production run:
-- 1,592 inserts (1 Beacontek + 1,591 historical gap fills).
-- -----------------------------------------------------------------------------

-- Promote an existing non-primary row that already matches companies.domain.
UPDATE public.company_domains cd
SET is_primary = true
FROM public.companies c
WHERE cd.company_id = c.id
  AND c.domain IS NOT NULL
  AND trim(c.domain) <> ''
  AND lower(trim(cd.domain)) = lower(trim(c.domain))
  AND cd.is_primary = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_domains other
    WHERE other.company_id = c.id
      AND other.is_primary = true
  );

-- Otherwise insert a new primary row for companies.domain when safe.
INSERT INTO public.company_domains (company_id, domain, is_primary)
SELECT c.id, trim(c.domain), true
FROM public.companies c
WHERE c.domain IS NOT NULL
  AND trim(c.domain) <> ''
  AND NOT (
    lower(trim(c.domain)) IN ('facebook.com', 'fb.com', 'm.facebook.com')
    OR lower(trim(c.domain)) LIKE 'facebook.com/%'
    OR lower(trim(c.domain)) LIKE 'fb.com/%'
    OR lower(trim(c.domain)) LIKE 'm.facebook.com/%'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_domains cd
    WHERE cd.company_id = c.id
      AND cd.is_primary = true
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_domains other
    WHERE lower(trim(other.domain)) = lower(trim(c.domain))
  );

-- -----------------------------------------------------------------------------
-- 4) Open sponsor import rows: null normalized_domain + unwind domain matches
--    (terminal batches published/discarded are left alone)
-- -----------------------------------------------------------------------------

UPDATE public.sponsor_import_rows r
SET
  normalized_domain = NULL,
  proposed_company_id = NULL,
  match_method = CASE
    WHEN r.match_method = 'domain' THEN NULL
    ELSE r.match_method
  END,
  match_confidence = CASE
    WHEN r.match_method = 'domain' THEN NULL
    ELSE r.match_confidence
  END,
  conflict_type = NULL,
  status = CASE
    WHEN r.status = 'resolved' AND r.match_method = 'domain' THEN 'needs_review'
    ELSE r.status
  END,
  decision_type = CASE
    WHEN r.status = 'resolved' AND r.match_method = 'domain' THEN NULL
    ELSE r.decision_type
  END,
  decision_source = CASE
    WHEN r.status = 'resolved' AND r.match_method = 'domain' THEN NULL
    ELSE r.decision_source
  END,
  resolved_company_id = CASE
    WHEN r.status = 'resolved' AND r.match_method = 'domain' THEN NULL
    ELSE r.resolved_company_id
  END,
  decision_by = CASE
    WHEN r.status = 'resolved' AND r.match_method = 'domain' THEN NULL
    ELSE r.decision_by
  END,
  decision_at = CASE
    WHEN r.status = 'resolved' AND r.match_method = 'domain' THEN NULL
    ELSE r.decision_at
  END
FROM public.sponsor_import_batches b
WHERE r.batch_id = b.id
  AND b.status NOT IN ('published', 'discarded')
  AND r.normalized_domain IS NOT NULL
  AND (
    lower(trim(r.normalized_domain)) IN ('facebook.com', 'fb.com', 'm.facebook.com')
    OR lower(trim(r.normalized_domain)) LIKE 'facebook.com/%'
    OR lower(trim(r.normalized_domain)) LIKE 'fb.com/%'
    OR lower(trim(r.normalized_domain)) LIKE 'm.facebook.com/%'
  );
