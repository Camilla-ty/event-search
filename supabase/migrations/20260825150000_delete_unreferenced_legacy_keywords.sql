-- Step 1 of the four-keyword taxonomy cleanup.
-- Delete legacy keyword catalog rows that have no Event Series assignments and
-- no Research Page references. `bitcoin` is intentionally excluded here; it is
-- removed in a later migration after its hub code is generalized.
-- Keeps: ai, fintech, healthtech, crypto-blockchain, bitcoin.

DO $$
DECLARE
  legacy_slugs text[] := ARRAY[
    'banking',
    'payments',
    'cybersecurity',
    'startups',
    'venture-capital',
    'cloud',
    'data-analytics',
    'healthcare',
    'tokenization',
    'digital-assets',
    'defi',
    'crypto',
    'blockchain-web3'
  ];
  bitcoin_before boolean;
  series_refs bigint;
  research_refs bigint;
  deleted_count bigint;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.keyword WHERE slug = 'bitcoin')
  INTO bitcoin_before;

  SELECT COUNT(*) INTO series_refs
  FROM public.event_series_keyword esk
  JOIN public.keyword k ON k.id = esk.keyword_id
  WHERE k.slug = ANY (legacy_slugs);

  IF series_refs > 0 THEN
    RAISE EXCEPTION
      'Aborting: % event_series_keyword rows still reference legacy keywords', series_refs;
  END IF;

  SELECT COUNT(*) INTO research_refs
  FROM public.topic_region_research_pages tr
  JOIN public.keyword k ON k.id = tr.topic_keyword_id
  WHERE k.slug = ANY (legacy_slugs);

  IF research_refs > 0 THEN
    RAISE EXCEPTION
      'Aborting: % research pages still reference legacy keywords', research_refs;
  END IF;

  DELETE FROM public.keyword WHERE slug = ANY (legacy_slugs);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % legacy keyword rows', deleted_count;

  IF EXISTS (SELECT 1 FROM public.keyword WHERE slug = ANY (legacy_slugs)) THEN
    RAISE EXCEPTION 'Aborting: legacy keyword rows still present after delete';
  END IF;

  -- Only assert survival when bitcoin was present beforehand: migration
  -- 20260825160000 removes it, so this file must stay re-runnable afterwards.
  IF bitcoin_before AND NOT EXISTS (SELECT 1 FROM public.keyword WHERE slug = 'bitcoin') THEN
    RAISE EXCEPTION 'Aborting: bitcoin keyword must survive this migration';
  END IF;

  IF (
    SELECT COUNT(*) FROM public.keyword
    WHERE slug IN ('ai', 'fintech', 'healthtech', 'crypto-blockchain')
  ) <> 4 THEN
    RAISE EXCEPTION 'Aborting: the four target keywords must all survive';
  END IF;
END $$;
