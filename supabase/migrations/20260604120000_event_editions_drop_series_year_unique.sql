-- Allow multiple event editions per series and year (e.g. TOKEN2049 Singapore vs Dubai 2026).
-- Canonical edition identity remains globally unique slug.
-- series_id + year + city_id is not enforced at DB level (admin warnings only).

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'event_editions'
    AND c.contype = 'u'
    AND (
      SELECT array_agg(a.attname::text ORDER BY u.ord)
      FROM unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = u.attnum
    ) = ARRAY['series_id', 'year'];

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.event_editions DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END $$;

-- Fallback names (no-op if already dropped). Live DB uses events_series_id_year_key.
ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS events_series_id_year_key;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_series_id_year_key;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_series_id_year_unique;

DROP INDEX IF EXISTS public.events_series_id_year_key;
DROP INDEX IF EXISTS public.event_editions_series_id_year_key;
