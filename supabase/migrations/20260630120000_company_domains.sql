-- Phase 2 (company domain matching): company_domains table + primary-domain backfill.
-- See docs/adr/ADR-001-company-identity.md and docs/implementation/company-domain-matching-v1.md
--
-- Active company convention (matches app queries):
--   status = 'active'::public.company_status
--   (implies merged_into_company_id IS NULL via companies_active_not_merged)
--
-- Edge cases (documented; not auto-resolved here):
--   * Merged companies (status = 'merged') are excluded from backfill; merge_companies()
--     clears duplicate.domain to NULL, so they typically have no domain anyway.
--   * Null or blank companies.domain rows are skipped.
--   * Duplicate domains among active companies will cause the unique index step to fail;
--     resolve via merge or manual cleanup before re-running. Pre-check:
--       SELECT lower(trim(domain)) AS domain_key, count(*) AS company_count,
--              array_agg(id ORDER BY created_at) AS company_ids
--       FROM public.companies
--       WHERE status = 'active'::public.company_status
--         AND domain IS NOT NULL
--         AND trim(domain) <> ''
--       GROUP BY 1
--       HAVING count(*) > 1;
--   * companies.domain is copied verbatim (already normalized at write time in app code).
--   * createCompany() does not yet insert company_domains (deferred to Phase 5/6).

-- =============================================================================
-- company_domains
-- =============================================================================

CREATE TABLE public.company_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  domain text NOT NULL,
  is_primary boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_domains_domain_not_blank CHECK (trim(domain) <> '')
);

CREATE INDEX company_domains_company_id_idx
  ON public.company_domains (company_id);

-- =============================================================================
-- Backfill: one primary domain per active company with companies.domain set
-- =============================================================================

INSERT INTO public.company_domains (company_id, domain, is_primary)
SELECT
  c.id,
  c.domain,
  true
FROM public.companies c
WHERE c.status = 'active'::public.company_status
  AND c.domain IS NOT NULL
  AND trim(c.domain) <> '';

-- =============================================================================
-- Duplicate prevention (after backfill so migration fails loudly on bad data)
-- =============================================================================

CREATE UNIQUE INDEX company_domains_domain_uidx
  ON public.company_domains (lower(domain));

CREATE UNIQUE INDEX company_domains_one_primary_per_company_uidx
  ON public.company_domains (company_id)
  WHERE is_primary = true;

-- =============================================================================
-- RLS: service-role only (internal identity data; no public/admin UI in Phase 2)
-- =============================================================================

ALTER TABLE public.company_domains ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_domains FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_domains TO service_role;

-- =============================================================================
-- Post-migration verification (run manually or via supabase/verify/company_domains_phase2_post_migration.sql)
-- =============================================================================
--
-- Active companies with non-null domain:
--   SELECT count(*) FROM public.companies
--   WHERE status = 'active'::public.company_status
--     AND domain IS NOT NULL AND trim(domain) <> '';
--
-- Backfilled primary rows:
--   SELECT count(*) FROM public.company_domains WHERE is_primary = true;
--
-- Duplicate domains in company_domains:
--   SELECT lower(domain) AS domain_key, count(*) FROM public.company_domains
--   GROUP BY 1 HAVING count(*) > 1;
--
-- Active companies missing company_domains despite domain:
--   SELECT c.id, c.name, c.domain
--   FROM public.companies c
--   LEFT JOIN public.company_domains cd ON cd.company_id = c.id AND cd.is_primary = true
--   WHERE c.status = 'active'::public.company_status
--     AND c.domain IS NOT NULL AND trim(c.domain) <> ''
--     AND cd.id IS NULL;
