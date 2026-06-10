-- Rename legacy event_series_categories → event_series_keyword (category_id → keyword_id).
-- Idempotent: handles rename from legacy table, or ensures schema if already renamed/created.
-- Fails loudly if BOTH tables exist (manual merge required).

DO $$
BEGIN
  IF to_regclass('public.event_series_keyword') IS NOT NULL
     AND to_regclass('public.event_series_categories') IS NOT NULL THEN
    RAISE EXCEPTION
      'Both public.event_series_keyword and public.event_series_categories exist. '
      'Stop and merge manually: '
      '1) INSERT INTO event_series_keyword (series_id, keyword_id) '
      '   SELECT series_id, category_id FROM event_series_categories '
      '   ON CONFLICT DO NOTHING; '
      '2) DROP TABLE public.event_series_categories; '
      '3) Re-run this migration.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Path A: legacy table exists — rename in place (preserves all row data)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.event_series_categories') IS NOT NULL
     AND to_regclass('public.event_series_keyword') IS NULL THEN

    ALTER TABLE public.event_series_categories RENAME TO event_series_keyword;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'event_series_keyword'
        AND column_name = 'category_id'
    ) THEN
      ALTER TABLE public.event_series_keyword RENAME COLUMN category_id TO keyword_id;
    END IF;

    -- Rename PK if it still uses the legacy constraint name
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.event_series_keyword'::regclass
        AND conname = 'event_series_categories_pkey'
    ) THEN
      ALTER TABLE public.event_series_keyword
        RENAME CONSTRAINT event_series_categories_pkey TO event_series_keyword_pkey;
    END IF;

    -- Rename legacy FK constraints when present
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.event_series_keyword'::regclass
        AND conname = 'event_series_categories_series_id_fkey'
    ) THEN
      ALTER TABLE public.event_series_keyword
        RENAME CONSTRAINT event_series_categories_series_id_fkey
        TO event_series_keyword_series_id_fkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.event_series_keyword'::regclass
        AND conname = 'event_series_categories_category_id_fkey'
    ) THEN
      ALTER TABLE public.event_series_keyword
        RENAME CONSTRAINT event_series_categories_category_id_fkey
        TO event_series_keyword_keyword_id_fkey;
    END IF;

    -- Alternate legacy names (categories_* from renamed keyword table)
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.event_series_keyword'::regclass
        AND conname = 'event_series_categories_keyword_id_fkey'
    ) THEN
      ALTER TABLE public.event_series_keyword
        RENAME CONSTRAINT event_series_categories_keyword_id_fkey
        TO event_series_keyword_keyword_id_fkey;
    END IF;

    -- Rename index on keyword_id if legacy name remains
    IF to_regclass('public.idx_event_series_categories_category_id') IS NOT NULL THEN
      ALTER INDEX public.idx_event_series_categories_category_id
        RENAME TO idx_event_series_keyword_keyword_id;
    END IF;

    IF to_regclass('public.idx_event_series_categories_keyword_id') IS NOT NULL THEN
      ALTER INDEX public.idx_event_series_categories_keyword_id
        RENAME TO idx_event_series_keyword_keyword_id;
    END IF;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Path B: greenfield — neither table exists (dev/staging without legacy data)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_series_keyword (
  series_id uuid NOT NULL REFERENCES public.event_series (id) ON DELETE CASCADE,
  keyword_id uuid NOT NULL REFERENCES public.keyword (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_series_keyword_pkey PRIMARY KEY (series_id, keyword_id)
);

-- ---------------------------------------------------------------------------
-- Ensure created_at exists (legacy rename path may omit it)
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_series_keyword
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- Ensure PK (series_id, keyword_id)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_series_keyword'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.event_series_keyword
      ADD CONSTRAINT event_series_keyword_pkey PRIMARY KEY (series_id, keyword_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Ensure FK series_id → event_series ON DELETE CASCADE
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fk_name text;
  delete_rule text;
BEGIN
  SELECT c.conname, rc.delete_rule
  INTO fk_name, delete_rule
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = c.conname
   AND rc.constraint_schema = 'public'
  WHERE c.conrelid = 'public.event_series_keyword'::regclass
    AND c.contype = 'f'
    AND a.attname = 'series_id'
  LIMIT 1;

  IF fk_name IS NULL THEN
    ALTER TABLE public.event_series_keyword
      ADD CONSTRAINT event_series_keyword_series_id_fkey
      FOREIGN KEY (series_id) REFERENCES public.event_series (id) ON DELETE CASCADE;
  ELSIF delete_rule <> 'CASCADE' THEN
    EXECUTE format(
      'ALTER TABLE public.event_series_keyword DROP CONSTRAINT %I',
      fk_name
    );
    ALTER TABLE public.event_series_keyword
      ADD CONSTRAINT event_series_keyword_series_id_fkey
      FOREIGN KEY (series_id) REFERENCES public.event_series (id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Ensure FK keyword_id → keyword ON DELETE RESTRICT
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fk_name text;
  delete_rule text;
BEGIN
  SELECT c.conname, rc.delete_rule
  INTO fk_name, delete_rule
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = c.conname
   AND rc.constraint_schema = 'public'
  WHERE c.conrelid = 'public.event_series_keyword'::regclass
    AND c.contype = 'f'
    AND a.attname = 'keyword_id'
  LIMIT 1;

  IF fk_name IS NULL THEN
    ALTER TABLE public.event_series_keyword
      ADD CONSTRAINT event_series_keyword_keyword_id_fkey
      FOREIGN KEY (keyword_id) REFERENCES public.keyword (id) ON DELETE RESTRICT;
  ELSIF delete_rule <> 'RESTRICT' AND delete_rule <> 'NO ACTION' THEN
    EXECUTE format(
      'ALTER TABLE public.event_series_keyword DROP CONSTRAINT %I',
      fk_name
    );
    ALTER TABLE public.event_series_keyword
      ADD CONSTRAINT event_series_keyword_keyword_id_fkey
      FOREIGN KEY (keyword_id) REFERENCES public.keyword (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_series_keyword_keyword_id
  ON public.event_series_keyword (keyword_id);

-- ---------------------------------------------------------------------------
-- RLS: public SELECT; writes via service_role only
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_series_keyword ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_series_keyword_select_anon_all" ON public.event_series_keyword;
DROP POLICY IF EXISTS "event_series_keyword_select_authenticated_all" ON public.event_series_keyword;

-- Drop legacy policy names if present
DROP POLICY IF EXISTS "public read event_series_categories" ON public.event_series_keyword;
DROP POLICY IF EXISTS "event_series_categories_select_anon_all" ON public.event_series_keyword;
DROP POLICY IF EXISTS "event_series_categories_select_authenticated_all" ON public.event_series_keyword;

CREATE POLICY "event_series_keyword_select_anon_all"
  ON public.event_series_keyword
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "event_series_keyword_select_authenticated_all"
  ON public.event_series_keyword
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.event_series_keyword FROM anon, authenticated;
GRANT SELECT ON TABLE public.event_series_keyword TO anon, authenticated;
GRANT ALL ON TABLE public.event_series_keyword TO service_role;
