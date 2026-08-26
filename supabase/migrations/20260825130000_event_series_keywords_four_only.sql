-- Correct direction: Event Series keywords use only the existing M2M
-- (event_series_keyword), with exactly one of the four target keywords per series.
--
-- Also rolls back the mistaken primary_industry_keyword_id design:
--   - No app/TypeScript code depends on that column (docs + prior migration only).
--   - Drop column / trigger / function / index here.
--
-- Does NOT delete unused keyword catalog rows (research pages and /topics/{slug}
-- still reference some non-target keywords such as bitcoin).

-- ---------------------------------------------------------------------------
-- 1) Ensure the four target keywords exist
-- ---------------------------------------------------------------------------
INSERT INTO public.keyword (name, slug)
VALUES
  ('AI', 'ai'),
  ('FinTech', 'fintech'),
  ('HealthTech', 'healthtech'),
  ('Crypto & Blockchain', 'crypto-blockchain')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Roll back primary_industry_keyword_id (safe: no app consumers)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_event_series_primary_industry_keyword
  ON public.event_series;

DROP FUNCTION IF EXISTS public.enforce_event_series_primary_industry_keyword();

ALTER TABLE public.event_series
  DROP CONSTRAINT IF EXISTS event_series_primary_industry_keyword_id_fkey;

DROP INDEX IF EXISTS public.idx_event_series_primary_industry_keyword_id;

ALTER TABLE public.event_series
  DROP COLUMN IF EXISTS primary_industry_keyword_id;

-- ---------------------------------------------------------------------------
-- 3) Snapshot target keyword ids
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  crypto_id uuid;
  fintech_id uuid;
  link_count integer;
  series_count integer;
  multi_assigned integer;
  unassigned integer;
BEGIN
  SELECT id INTO crypto_id FROM public.keyword WHERE slug = 'crypto-blockchain';
  SELECT id INTO fintech_id FROM public.keyword WHERE slug = 'fintech';

  IF crypto_id IS NULL OR fintech_id IS NULL THEN
    RAISE EXCEPTION 'Missing required keyword rows (crypto-blockchain / fintech)';
  END IF;

  -- Replace ALL series↔keyword links (approved: discard old topic assignments)
  DELETE FROM public.event_series_keyword;

  INSERT INTO public.event_series_keyword (series_id, keyword_id)
  SELECT es.id, crypto_id
  FROM public.event_series es
  WHERE es.name IN (
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

  INSERT INTO public.event_series_keyword (series_id, keyword_id)
  SELECT es.id, fintech_id
  FROM public.event_series es
  WHERE es.name IN (
    'GITEX FDX(Future Finance & Digital Assets Expo)',
    'Hong Kong FinTech Week',
    'Singapore Fintech Festival',
    'StartmeupHK Festival'
  );

  SELECT COUNT(*) INTO series_count FROM public.event_series;
  SELECT COUNT(*) INTO link_count FROM public.event_series_keyword;

  SELECT COUNT(*) INTO multi_assigned
  FROM (
    SELECT series_id
    FROM public.event_series_keyword
    GROUP BY series_id
    HAVING COUNT(*) <> 1
  ) t;

  SELECT COUNT(*) INTO unassigned
  FROM public.event_series es
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_series_keyword esk WHERE esk.series_id = es.id
  );

  IF series_count <> 39 THEN
    RAISE EXCEPTION 'Expected 39 event_series rows, found %', series_count;
  END IF;

  IF link_count <> 39 THEN
    RAISE EXCEPTION 'Expected 39 event_series_keyword rows, found %', link_count;
  END IF;

  IF multi_assigned <> 0 THEN
    RAISE EXCEPTION '% series do not have exactly one keyword', multi_assigned;
  END IF;

  IF unassigned <> 0 THEN
    RAISE EXCEPTION '% series have no keyword assignment', unassigned;
  END IF;
END $$;
