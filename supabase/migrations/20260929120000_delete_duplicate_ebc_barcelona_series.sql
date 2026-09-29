-- Delete the accidental duplicate Event Series "European Blockchain Convention Barcelona"
-- (created 2026-09-29, no editions). The canonical series is
-- "European Blockchain Convention" (aded70b0-334e-4bac-8128-1825e455432b), which already
-- holds the Barcelona 2026 edition.
-- Does not touch the canonical series, its editions, companies, or storage objects.
-- The duplicate's logo object (company-logos/event-series/c46cf7e0-.../logo.png) is left
-- in storage and must be removed separately.

DO $$
DECLARE
  dup_id constant uuid := 'c46cf7e0-7e7a-4df0-842b-2c8b850c02a0';
  canonical_id constant uuid := 'aded70b0-334e-4bac-8128-1825e455432b';
  dup_name text;
  dup_slug text;
  dup_merged_into uuid;
  edition_count integer;
  sponsor_count integer;
  exhibitor_count integer;
  organizer_count integer;
  pa_program_count integer;
  pa_batch_count integer;
  merged_into_dup_count integer;
  keyword_count integer;
  keyword_slugs text;
  canonical_edition_count integer;
BEGIN
  SELECT name, slug, merged_into_series_id
  INTO dup_name, dup_slug, dup_merged_into
  FROM public.event_series
  WHERE id = dup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aborting: duplicate series % not found', dup_id;
  END IF;

  IF dup_name IS DISTINCT FROM 'European Blockchain Convention Barcelona'
     OR dup_slug IS DISTINCT FROM 'european-blockchain-convention-barcelona' THEN
    RAISE EXCEPTION 'Aborting: series % is not the expected duplicate (name=%, slug=%)',
      dup_id, dup_name, dup_slug;
  END IF;

  IF dup_merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Aborting: duplicate series is itself merged into %', dup_merged_into;
  END IF;

  SELECT COUNT(*) INTO edition_count
  FROM public.event_editions WHERE series_id = dup_id;

  SELECT COUNT(*) INTO sponsor_count
  FROM public.event_sponsors s
  JOIN public.event_editions e ON e.id = s.event_editions_id
  WHERE e.series_id = dup_id;

  SELECT COUNT(*) INTO exhibitor_count
  FROM public.event_exhibitors x
  JOIN public.event_editions e ON e.id = x.event_editions_id
  WHERE e.series_id = dup_id;

  SELECT COUNT(*) INTO organizer_count
  FROM public.event_edition_organizers o
  JOIN public.event_editions e ON e.id = o.event_editions_id
  WHERE e.series_id = dup_id;

  SELECT COUNT(*) INTO pa_program_count
  FROM public.event_partner_alumni WHERE event_series_id = dup_id;

  SELECT COUNT(*) INTO pa_batch_count
  FROM public.partner_alumni_import_batches WHERE event_series_id = dup_id;

  SELECT COUNT(*) INTO merged_into_dup_count
  FROM public.event_series WHERE merged_into_series_id = dup_id;

  IF edition_count <> 0 OR sponsor_count <> 0 OR exhibitor_count <> 0
     OR organizer_count <> 0 OR pa_program_count <> 0 OR pa_batch_count <> 0
     OR merged_into_dup_count <> 0 THEN
    RAISE EXCEPTION
      'Aborting: duplicate series has dependents (editions=%, sponsors=%, exhibitors=%, organizers=%, pa_programs=%, pa_batches=%, merged_into=%)',
      edition_count, sponsor_count, exhibitor_count, organizer_count,
      pa_program_count, pa_batch_count, merged_into_dup_count;
  END IF;

  SELECT COUNT(*), string_agg(k.slug, ',' ORDER BY k.slug)
  INTO keyword_count, keyword_slugs
  FROM public.event_series_keyword sk
  JOIN public.keyword k ON k.id = sk.keyword_id
  WHERE sk.series_id = dup_id;

  IF keyword_count <> 1 OR keyword_slugs IS DISTINCT FROM 'crypto-blockchain' THEN
    RAISE EXCEPTION
      'Aborting: expected exactly one keyword link (crypto-blockchain), found % (%)',
      keyword_count, COALESCE(keyword_slugs, 'none');
  END IF;

  SELECT COUNT(*) INTO canonical_edition_count
  FROM public.event_editions WHERE series_id = canonical_id;

  IF canonical_edition_count <> 1 THEN
    RAISE EXCEPTION
      'Aborting: canonical series % expected 1 edition, found %',
      canonical_id, canonical_edition_count;
  END IF;

  -- event_series_keyword cascades on series delete; removed explicitly so the
  -- delete is visible here rather than implied by the FK.
  DELETE FROM public.event_series_keyword WHERE series_id = dup_id;
  DELETE FROM public.event_series WHERE id = dup_id;

  IF EXISTS (SELECT 1 FROM public.event_series WHERE id = dup_id) THEN
    RAISE EXCEPTION 'Duplicate series still present after delete';
  END IF;

  IF EXISTS (SELECT 1 FROM public.event_series_keyword WHERE series_id = dup_id) THEN
    RAISE EXCEPTION 'Keyword links for duplicate series still present after delete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_series
    WHERE id = canonical_id AND slug = 'european-blockchain-convention'
  ) OR (SELECT COUNT(*) FROM public.event_editions WHERE series_id = canonical_id) <> 1 THEN
    RAISE EXCEPTION 'Canonical series or its edition changed unexpectedly';
  END IF;
END $$;
