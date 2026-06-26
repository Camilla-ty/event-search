-- Phase 10 (company domain matching): remove optional admin note from company_domains.

ALTER TABLE public.company_domains
  DROP COLUMN IF EXISTS note;
