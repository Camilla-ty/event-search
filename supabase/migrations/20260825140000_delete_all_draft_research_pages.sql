-- Delete all existing Research Pages (all drafts; never published).
-- Rebuild later against the four-keyword taxonomy.
-- Does NOT delete keyword catalog rows or touch event_series / event_series_keyword.

DO $$
DECLARE
  total_count integer;
  published_count integer;
  with_published_at integer;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'published'),
    COUNT(*) FILTER (WHERE published_at IS NOT NULL)
  INTO total_count, published_count, with_published_at
  FROM public.topic_region_research_pages;

  IF published_count > 0 OR with_published_at > 0 THEN
    RAISE EXCEPTION
      'Refusing to wipe research pages: found published=% with_published_at=% (expected all drafts)',
      published_count,
      with_published_at;
  END IF;

  IF total_count <> 7 THEN
    RAISE EXCEPTION
      'Refusing to wipe research pages: expected exactly 7 draft rows, found %',
      total_count;
  END IF;

  DELETE FROM public.topic_region_research_pages;

  IF (SELECT COUNT(*) FROM public.topic_region_research_pages) <> 0 THEN
    RAISE EXCEPTION 'topic_region_research_pages is not empty after delete';
  END IF;
END $$;
