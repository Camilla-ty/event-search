-- Primary Industry for Event Series (distinct from Topic keywords).
--
-- Industry vs Topic:
--   - Topics remain on public.event_series_keyword (many-to-many). Untouched by this migration.
--   - Primary Industry is a single FK on public.event_series.primary_industry_keyword_id.
--   - This avoids stuffing Industry into the Topic M2M (which would allow multiple
--     "industry-like" assignments and blur explorer/topic-hub behavior).
--
-- Allowed Industry keyword slugs: ai, fintech, healthtech, crypto-blockchain.

-- ---------------------------------------------------------------------------
-- 1) Ensure the four Industry keyword rows exist (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.keyword (name, slug)
VALUES
  ('AI', 'ai'),
  ('FinTech', 'fintech'),
  ('HealthTech', 'healthtech'),
  ('Crypto & Blockchain', 'crypto-blockchain')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Column + FK
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_series
  ADD COLUMN IF NOT EXISTS primary_industry_keyword_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.event_series'::regclass
      AND conname = 'event_series_primary_industry_keyword_id_fkey'
  ) THEN
    ALTER TABLE public.event_series
      ADD CONSTRAINT event_series_primary_industry_keyword_id_fkey
      FOREIGN KEY (primary_industry_keyword_id)
      REFERENCES public.keyword (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_series_primary_industry_keyword_id
  ON public.event_series (primary_industry_keyword_id);

-- ---------------------------------------------------------------------------
-- 3) Enforce only Industry keyword slugs on the FK
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_event_series_primary_industry_keyword()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  industry_slug text;
BEGIN
  IF NEW.primary_industry_keyword_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT k.slug INTO industry_slug
  FROM public.keyword k
  WHERE k.id = NEW.primary_industry_keyword_id;

  IF industry_slug IS NULL THEN
    RAISE EXCEPTION 'primary_industry_keyword_id % does not exist in keyword', NEW.primary_industry_keyword_id;
  END IF;

  IF industry_slug NOT IN ('ai', 'fintech', 'healthtech', 'crypto-blockchain') THEN
    RAISE EXCEPTION
      'primary_industry_keyword_id must reference an Industry keyword (ai|fintech|healthtech|crypto-blockchain); got slug=%',
      industry_slug;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_series_primary_industry_keyword
  ON public.event_series;

CREATE TRIGGER trg_event_series_primary_industry_keyword
  BEFORE INSERT OR UPDATE OF primary_industry_keyword_id
  ON public.event_series
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_series_primary_industry_keyword();

-- ---------------------------------------------------------------------------
-- 4) Backfill: Crypto & Blockchain (35 series)
-- ---------------------------------------------------------------------------
UPDATE public.event_series es
SET primary_industry_keyword_id = k.id
FROM public.keyword k
WHERE k.slug = 'crypto-blockchain'
  AND es.name IN (
    'Avalanche Summit',
    'Bitcoin Amsterdam',
    'Bitcoin Conference',
    'Blockchain Expo Global Series',
    'Blockchain Futurist Conference',
    'Blockchain Life Dubai',
    'Blockworks Digital Asset Summit',
    'BTC Prague',
    'Chainlink SmartCon',
    'Consensus by CoinDesk',
    'Consensus Hong Kong',
    'DC Blockchain Summit',
    'Dcentral Miami',
    'Devcon',
    'Digital Asset Summit',
    'Digital Assets Summit (DA Summit)',
    'Digital Assets Week',
    'Dutch Blockchain Week',
    'ETHDenver',
    'Ethereum Community Conference (EthCC)',
    'ETHGlobal',
    'ETHWomen',
    'European Blockchain Convention',
    'HODL Summit',
    'Istanbul Blockchain Week',
    'Korea Blockchain Week',
    'London Blockchain Conference',
    'NFT NYC',
    'Nordic Blockchain Conference',
    'Paris Blockchain Week',
    'Permissionless',
    'Solana Breakpoint',
    'TOKEN2049',
    'Tokenize: LDN',
    'WebX Tokyo'
  );

-- ---------------------------------------------------------------------------
-- 5) Backfill: FinTech (4 series)
-- ---------------------------------------------------------------------------
UPDATE public.event_series es
SET primary_industry_keyword_id = k.id
FROM public.keyword k
WHERE k.slug = 'fintech'
  AND es.name IN (
    'GITEX FDX(Future Finance & Digital Assets Expo)',
    'Hong Kong FinTech Week',
    'Singapore Fintech Festival',
    'StartmeupHK Festival'
  );

-- ---------------------------------------------------------------------------
-- 6) Fail loudly if any series is missing a primary industry
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing_count integer;
  missing_names text;
BEGIN
  SELECT COUNT(*), string_agg(name, ', ' ORDER BY name)
  INTO missing_count, missing_names
  FROM public.event_series
  WHERE primary_industry_keyword_id IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION
      'primary industry backfill incomplete: % series still null (%).',
      missing_count,
      missing_names;
  END IF;
END $$;
