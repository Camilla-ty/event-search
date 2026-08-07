-- Move DFINITY social company_domains from Internet Computer to DFINITY Foundation.
-- Scope only:
--   linkedin.com/company/dfinity
--   x.com/dfinity
-- Does not touch sponsorships, merges, primary websites/domains, aliases, or other domains.
-- Idempotent: no-op when those rows are already owned by the DFINITY Foundation company.

UPDATE public.company_domains AS cd
SET company_id = dfinity.id
FROM public.companies AS ic
JOIN public.companies AS dfinity
  ON lower(trim(dfinity.domain)) = 'dfinity.org'
 AND dfinity.status = 'active'::public.company_status
WHERE lower(trim(ic.domain)) = 'internetcomputer.org'
  AND ic.status = 'active'::public.company_status
  AND cd.company_id = ic.id
  AND lower(trim(cd.domain)) IN (
    'linkedin.com/company/dfinity',
    'x.com/dfinity'
  )
  AND cd.is_primary = false;
