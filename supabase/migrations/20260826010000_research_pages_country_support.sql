-- Extend research pages from Keyword × Region to Keyword × Location × optional Year,
-- where Location is exactly one of Region or Country.
--
-- region_id becomes nullable and country_id is added, with a CHECK enforcing
-- exactly one. Real foreign keys are kept to both tables rather than a
-- polymorphic (type, id) pair, so referential integrity survives.
--
-- Also fixes the truncated `thailan` country slug: country slugs become public
-- research-page URLs under /events/topics/{topic}/countries/{country}.

ALTER TABLE public.topic_region_research_pages
  ALTER COLUMN region_id DROP NOT NULL;

ALTER TABLE public.topic_region_research_pages
  ADD COLUMN IF NOT EXISTS country_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.topic_region_research_pages'::regclass
      AND conname = 'topic_region_research_pages_country_id_fkey'
  ) THEN
    ALTER TABLE public.topic_region_research_pages
      ADD CONSTRAINT topic_region_research_pages_country_id_fkey
      FOREIGN KEY (country_id) REFERENCES public.countries (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.topic_region_research_pages'::regclass
      AND conname = 'topic_region_research_pages_one_location_check'
  ) THEN
    ALTER TABLE public.topic_region_research_pages
      ADD CONSTRAINT topic_region_research_pages_one_location_check
      CHECK (num_nonnulls(region_id, country_id) = 1);
  END IF;
END $$;

-- Uniqueness per location kind. COALESCE(year, 0) keeps all-years rows
-- (year IS NULL) participating in uniqueness instead of being mutually distinct.
DROP INDEX IF EXISTS public.topic_region_research_pages_topic_region_year_key;

CREATE UNIQUE INDEX IF NOT EXISTS topic_region_research_pages_topic_region_year_key
  ON public.topic_region_research_pages (
    topic_keyword_id, region_id, COALESCE((year)::integer, 0)
  )
  WHERE region_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS topic_region_research_pages_topic_country_year_key
  ON public.topic_region_research_pages (
    topic_keyword_id, country_id, COALESCE((year)::integer, 0)
  )
  WHERE country_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_topic_region_research_pages_country_id
  ON public.topic_region_research_pages (country_id);

-- The published view must be dropped rather than replaced: its column names
-- change from region_* to location_*, and CREATE OR REPLACE VIEW cannot rename
-- columns. Region rows and country rows are both surfaced via LEFT JOIN +
-- COALESCE; an INNER JOIN on regions would silently hide every country page.
DROP VIEW IF EXISTS public.topic_region_research_pages_published;

CREATE VIEW public.topic_region_research_pages_published
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.year,
  p.published_at,
  k.name AS topic_name,
  k.slug AS topic_slug,
  CASE WHEN p.country_id IS NOT NULL THEN 'country' ELSE 'region' END AS location_type,
  COALESCE(co.name, r.name) AS location_name,
  COALESCE(co.slug, r.slug) AS location_slug
FROM public.topic_region_research_pages p
INNER JOIN public.keyword k
  ON k.id = p.topic_keyword_id
LEFT JOIN public.regions r
  ON r.id = p.region_id
LEFT JOIN public.countries co
  ON co.id = p.country_id
WHERE p.status = 'published';

COMMENT ON VIEW public.topic_region_research_pages_published IS
  'Published Topic × Location (Region or Country) × optional year research pages '
  'for public sitemap and discovery. security_invoker=false. Draft/admin-only '
  'rows excluded.';

REVOKE ALL ON public.topic_region_research_pages_published FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.topic_region_research_pages_published TO anon, authenticated;

UPDATE public.countries
SET slug = 'thailand'
WHERE slug = 'thailan'
  AND NOT EXISTS (
    SELECT 1 FROM public.countries c2 WHERE c2.slug = 'thailand'
  );

DO $$
DECLARE
  bad_slugs integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.countries WHERE slug = 'thailan') THEN
    RAISE EXCEPTION 'Aborting: countries.slug "thailan" was not renamed';
  END IF;

  SELECT COUNT(*) INTO bad_slugs
  FROM public.topic_region_research_pages
  WHERE num_nonnulls(region_id, country_id) <> 1;

  IF bad_slugs > 0 THEN
    RAISE EXCEPTION 'Aborting: % research page rows do not have exactly one location', bad_slugs;
  END IF;
END $$;
