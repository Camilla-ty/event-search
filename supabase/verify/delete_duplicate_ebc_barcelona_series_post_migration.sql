-- Post-migration verification for
-- 20260929120000_delete_duplicate_ebc_barcelona_series.sql
-- Duplicate series:  c46cf7e0-7e7a-4df0-842b-2c8b850c02a0 (European Blockchain Convention Barcelona)
-- Canonical series:  aded70b0-334e-4bac-8128-1825e455432b (European Blockchain Convention)

-- Duplicate series must be gone (expect 0)
SELECT COUNT(*)::int AS duplicate_series_rows
FROM public.event_series
WHERE id = 'c46cf7e0-7e7a-4df0-842b-2c8b850c02a0'
   OR slug = 'european-blockchain-convention-barcelona';

-- Duplicate keyword links must be gone (expect 0)
SELECT COUNT(*)::int AS duplicate_keyword_rows
FROM public.event_series_keyword
WHERE series_id = 'c46cf7e0-7e7a-4df0-842b-2c8b850c02a0';

-- Canonical series unchanged (expect 1 row, active, not merged)
SELECT id, name, slug, lifecycle_status, merged_into_series_id, website_url, logo_url
FROM public.event_series
WHERE id = 'aded70b0-334e-4bac-8128-1825e455432b';

-- Canonical edition still attached (expect European Blockchain Convention Barcelona 2026)
SELECT id, name, slug, year, start_date, end_date
FROM public.event_editions
WHERE series_id = 'aded70b0-334e-4bac-8128-1825e455432b';

-- Canonical keyword link intact (expect crypto-blockchain)
SELECT k.slug
FROM public.event_series_keyword sk
JOIN public.keyword k ON k.id = sk.keyword_id
WHERE sk.series_id = 'aded70b0-334e-4bac-8128-1825e455432b';

-- Duplicate logo object intentionally left in storage (expect 1)
SELECT COUNT(*)::int AS duplicate_logo_objects
FROM storage.objects
WHERE bucket_id = 'company-logos'
  AND name = 'event-series/c46cf7e0-7e7a-4df0-842b-2c8b850c02a0/logo.png';
