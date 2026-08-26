-- Remove NFT.NYC 2025 event_sponsors rows that incorrectly stored Partner Alumni
-- as a sponsor tier. Partner Alumni is series-scoped and must not contribute to
-- edition sponsor counts or the Sponsors tab.
--
-- Scope: edition e64f2830-df7b-433f-af6b-4952e389902d (NFT.NYC 2025) only.
-- Does not modify Partner Alumni tables or application read/query logic.

DO $$
DECLARE
  edition_id constant uuid := 'e64f2830-df7b-433f-af6b-4952e389902d';
  series_id constant uuid := '7fbab604-381c-4bf4-aac2-af25cabe2022';
  matched_count integer;
  remaining_count integer;
  remaining_partner_count integer;
  remaining_other_count integer;
  pa_public_members integer;
BEGIN
  SELECT COUNT(*)
  INTO matched_count
  FROM public.event_sponsors
  WHERE event_editions_id = edition_id
    AND tier_label = 'Partner Alumni'
    AND tier_rank = 2;

  IF matched_count <> 442 THEN
    RAISE EXCEPTION
      'Aborting NFT.NYC 2025 alumni-tier sponsor cleanup: expected exactly 442 rows matching tier_label=Partner Alumni and tier_rank=2, found %',
      matched_count;
  END IF;

  DELETE FROM public.event_sponsors
  WHERE event_editions_id = edition_id
    AND tier_label = 'Partner Alumni'
    AND tier_rank = 2;

  SELECT COUNT(*)
  INTO remaining_count
  FROM public.event_sponsors
  WHERE event_editions_id = edition_id;

  IF remaining_count <> 27 THEN
    RAISE EXCEPTION
      'Aborting after delete: expected exactly 27 event_sponsors rows remaining for NFT.NYC 2025, found %',
      remaining_count;
  END IF;

  SELECT
    COUNT(*) FILTER (
      WHERE tier_rank = 1 AND tier_label = '2025 Partner'
    ),
    COUNT(*) FILTER (
      WHERE NOT (tier_rank = 1 AND tier_label = '2025 Partner')
    )
  INTO remaining_partner_count, remaining_other_count
  FROM public.event_sponsors
  WHERE event_editions_id = edition_id;

  IF remaining_partner_count <> 27 OR remaining_other_count <> 0 THEN
    RAISE EXCEPTION
      'Aborting after delete: expected all 27 remaining rows to be 2025 Partner (tier_rank=1); found partner=% other=%',
      remaining_partner_count,
      remaining_other_count;
  END IF;

  SELECT COUNT(*)
  INTO pa_public_members
  FROM public.event_partner_alumni_public_members
  WHERE event_series_id = series_id;

  IF pa_public_members <> 454 THEN
    RAISE EXCEPTION
      'Aborting after delete: NFT NYC Partner Alumni public members must remain 454, found %',
      pa_public_members;
  END IF;
END $$;
