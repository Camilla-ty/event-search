-- Fix: production constraint is named events_series_id_year_key (not event_editions_*).
-- Safe to re-run: drops any UNIQUE on (series_id, year) regardless of name or column order.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'event_editions'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(c.conkey) AS u(attnum)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = u.attnum
      ) = ARRAY['series_id', 'year']::text[]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.event_editions DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS events_series_id_year_key;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_series_id_year_key;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_series_id_year_unique;

-- Some schemas use a standalone unique index with the same name.
DROP INDEX IF EXISTS public.events_series_id_year_key;
DROP INDEX IF EXISTS public.event_editions_series_id_year_key;
