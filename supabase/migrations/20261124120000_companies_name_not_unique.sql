-- Company names may be shared. Slug and domain stay unique.
-- sponsors_name_key is the legacy unique constraint on companies.name.
-- Do not rename existing companies. This statement only drops the constraint
-- and adds a non-unique index for case-insensitive name lookup.

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS sponsors_name_key;

CREATE INDEX IF NOT EXISTS companies_name_lower_idx
  ON public.companies (lower(btrim(name)));
