-- Post-migration verification for venues v1 (V9–V14 behavioral checks)
-- Runs in a single transaction and rolls back test mutations.

BEGIN;

INSERT INTO public.venues (id, name, slug, city_id)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Verify Venue',
  'verify-venue-v1',
  '7ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5'
);

DO $v9$
BEGIN
  UPDATE public.event_editions
  SET
    venue_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    city_id = '93be51ca-8c19-4cf4-ab98-02b5b19e6659'
  WHERE id = '46934db9-96c8-4737-8287-01c3ca490e1b';

  RAISE EXCEPTION 'V9_FAIL: mismatched city_id should have been rejected';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%city_id must match%' THEN
      RAISE;
    END IF;
END $v9$;

DO $v11$
BEGIN
  UPDATE public.event_editions
  SET
    city_id = NULL,
    venue_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  WHERE id = '46934db9-96c8-4737-8287-01c3ca490e1b';

  RAISE EXCEPTION 'V11_FAIL: venue_id with null city_id should have been rejected';
EXCEPTION
  WHEN check_violation THEN
    NULL;
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%city_id is required%'
      AND SQLERRM NOT LIKE '%venue_requires_city%' THEN
      RAISE;
    END IF;
END $v11$;

UPDATE public.event_editions
SET
  venue_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  city_id = '7ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5'
WHERE id = '46934db9-96c8-4737-8287-01c3ca490e1b';

UPDATE public.venues
SET archived_at = now()
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

DO $v14$
BEGIN
  DELETE FROM public.venues
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  RAISE EXCEPTION 'V14_FAIL: delete should be restricted while editions reference venue';
EXCEPTION
  WHEN foreign_key_violation THEN
    NULL;
END $v14$;

SELECT
  (SELECT COUNT(*)
   FROM public.venues
   WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     AND archived_at IS NOT NULL) AS v12_archived_visible,
  (SELECT COUNT(*)
   FROM public.event_editions AS ee
   INNER JOIN public.venues AS v ON v.id = ee.venue_id
   WHERE ee.id = '46934db9-96c8-4737-8287-01c3ca490e1b') AS v13_join_readable,
  'V10_OK' AS v10_matching_update;

ROLLBACK;
