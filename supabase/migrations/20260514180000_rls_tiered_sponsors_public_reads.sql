-- RLS: tiered sponsor visibility + public reads + client writes denied
-- Architecture (locked): event_sponsors tier_rank=1 for anon; all tiers for authenticated;
-- companies + event_editions + event_series fully public read; writes only via service_role.

-- ---------------------------------------------------------------------------
-- event_sponsors
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_sponsors_select_anon_tier_rank_1" ON public.event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_select_authenticated_all" ON public.event_sponsors;

CREATE POLICY "event_sponsors_select_anon_tier_rank_1"
  ON public.event_sponsors
  FOR SELECT
  TO anon
  USING (tier_rank = 1);

CREATE POLICY "event_sponsors_select_authenticated_all"
  ON public.event_sponsors
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.event_sponsors FROM anon, authenticated;
GRANT SELECT ON TABLE public.event_sponsors TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- companies (fully public read; no client writes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select_anon_all" ON public.companies;
DROP POLICY IF EXISTS "companies_select_authenticated_all" ON public.companies;

CREATE POLICY "companies_select_anon_all"
  ON public.companies
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "companies_select_authenticated_all"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.companies FROM anon, authenticated;
GRANT SELECT ON TABLE public.companies TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- event_editions (fully public read; no client writes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_editions_select_anon_all" ON public.event_editions;
DROP POLICY IF EXISTS "event_editions_select_authenticated_all" ON public.event_editions;

CREATE POLICY "event_editions_select_anon_all"
  ON public.event_editions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "event_editions_select_authenticated_all"
  ON public.event_editions
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.event_editions FROM anon, authenticated;
GRANT SELECT ON TABLE public.event_editions TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- event_series (fully public read; no client writes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_series_select_anon_all" ON public.event_series;
DROP POLICY IF EXISTS "event_series_select_authenticated_all" ON public.event_series;

CREATE POLICY "event_series_select_anon_all"
  ON public.event_series
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "event_series_select_authenticated_all"
  ON public.event_series
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.event_series FROM anon, authenticated;
GRANT SELECT ON TABLE public.event_series TO anon, authenticated;
