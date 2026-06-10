-- Phase 0: additive logo metadata on companies (no column renames/removals).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_source text,
  ADD COLUMN IF NOT EXISTS logo_status text,
  ADD COLUMN IF NOT EXISTS logo_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS logo_fetch_error text;

-- Phase 1: backfill metadata from existing logo_url / domain (logo_url values unchanged).

UPDATE public.companies
SET
  logo_source = 'manual',
  logo_status = 'ok'
WHERE logo_url IS NOT NULL
  AND (logo_source IS NULL OR logo_status IS NULL);

UPDATE public.companies
SET
  logo_source = 'logo_dev',
  logo_status = 'pending'
WHERE logo_url IS NULL
  AND domain IS NOT NULL
  AND (logo_source IS NULL OR logo_status IS NULL);

UPDATE public.companies
SET
  logo_source = 'none',
  logo_status = 'skipped'
WHERE logo_url IS NULL
  AND domain IS NULL
  AND (logo_source IS NULL OR logo_status IS NULL);
