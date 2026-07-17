-- Drop unused company prose columns after dependent functions were redefined.
ALTER TABLE public.companies
  DROP COLUMN IF EXISTS short_description,
  DROP COLUMN IF EXISTS description;
