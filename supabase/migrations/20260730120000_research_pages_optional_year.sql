-- Optional Year dimension for Topic × Region Research Pages.
-- year = NULL means "All years" (existing behaviour).
-- Existing rows are left untouched (DEFAULT NULL, no backfill).

ALTER TABLE public.topic_region_research_pages
  ADD COLUMN year smallint DEFAULT NULL;

COMMENT ON COLUMN public.topic_region_research_pages.year IS
  'Optional year filter. NULL = all years. Specific year = year-scoped page.';

-- Replace topic+region uniqueness with topic+region+year uniqueness.
-- COALESCE(year, 0) so only one all-years row (year IS NULL) is allowed per topic+region.
-- Year 0 is never a valid event year.
ALTER TABLE public.topic_region_research_pages
  DROP CONSTRAINT topic_region_research_pages_topic_keyword_id_region_id_key;

CREATE UNIQUE INDEX topic_region_research_pages_topic_region_year_key
  ON public.topic_region_research_pages (topic_keyword_id, region_id, COALESCE(year, 0));
