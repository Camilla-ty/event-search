-- Step 3 of the four-keyword taxonomy cleanup.
-- The Bitcoin x Asia hub code has been generalized to a topic-agnostic
-- topic x region hub, so nothing in the application depends on this slug.
-- Final catalog after this migration: ai, fintech, healthtech, crypto-blockchain.

DO $$
DECLARE
  series_refs bigint;
  research_refs bigint;
  remaining text;
BEGIN
  SELECT COUNT(*) INTO series_refs
  FROM public.event_series_keyword esk
  JOIN public.keyword k ON k.id = esk.keyword_id
  WHERE k.slug = 'bitcoin';

  IF series_refs > 0 THEN
    RAISE EXCEPTION
      'Aborting: % event_series_keyword rows still reference bitcoin', series_refs;
  END IF;

  SELECT COUNT(*) INTO research_refs
  FROM public.topic_region_research_pages tr
  JOIN public.keyword k ON k.id = tr.topic_keyword_id
  WHERE k.slug = 'bitcoin';

  IF research_refs > 0 THEN
    RAISE EXCEPTION
      'Aborting: % research pages still reference bitcoin', research_refs;
  END IF;

  DELETE FROM public.keyword WHERE slug = 'bitcoin';

  SELECT string_agg(slug, ', ' ORDER BY slug) INTO remaining FROM public.keyword;

  IF remaining IS DISTINCT FROM 'ai, crypto-blockchain, fintech, healthtech' THEN
    RAISE EXCEPTION
      'Aborting: keyword catalog must contain exactly the four target keywords, found: %',
      COALESCE(remaining, '(empty)');
  END IF;
END $$;
