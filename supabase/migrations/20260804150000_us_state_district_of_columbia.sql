-- Seed District of Columbia as a U.S. state (federal district, not a U.S. territory).
-- Idempotent: safe to re-run. Does not modify the existing 50 states.

INSERT INTO public.states (name, slug, country_id)
SELECT
  'District of Columbia',
  'district-of-columbia',
  c.id
FROM public.countries AS c
WHERE c.slug = 'united-states'
ON CONFLICT (country_id, name) DO NOTHING;
