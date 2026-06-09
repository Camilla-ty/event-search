-- Inspect all UNIQUE constraints and indexes on public.event_editions.
-- Run in Supabase SQL Editor after applying edition uniqueness migrations.

-- 1) Unique constraints (pg_constraint)
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'event_editions'
  AND c.contype = 'u'
ORDER BY c.conname;

-- 2) Unique indexes (including those backing constraints)
SELECT
  i.relname AS index_name,
  ix.indisunique AS is_unique,
  pg_get_indexdef(ix.indexrelid) AS index_definition
FROM pg_class t
JOIN pg_namespace n ON t.relnamespace = n.oid
JOIN pg_index ix ON ix.indrelid = t.oid
JOIN pg_class i ON i.oid = ix.indexrelid
WHERE n.nspname = 'public'
  AND t.relname = 'event_editions'
  AND ix.indisunique = true
ORDER BY i.relname;

-- 3) Pass/fail summary for edition uniqueness model
SELECT
  EXISTS (
    SELECT 1
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
  ) AS series_year_unique_still_exists,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'event_editions'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(slug)%'
  ) AS slug_unique_exists;

-- Expected after fix migration:
--   series_year_unique_still_exists = false
--   slug_unique_exists = true
