-- Topic × Region Research Pages: admin-managed approval table.
-- Only explicitly published combinations become public pages.
-- Content is always dynamically computed from current DB data.

CREATE TABLE public.topic_region_research_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_keyword_id uuid NOT NULL REFERENCES public.keyword(id),
  region_id        uuid NOT NULL REFERENCES public.regions(id),
  status      text NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_keyword_id, region_id)
);

COMMENT ON TABLE public.topic_region_research_pages IS
  'Admin-managed Topic × Region research page approvals. status=published makes the page public.';

-- RLS: admin-only writes, public reads for published rows only.
ALTER TABLE public.topic_region_research_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all rows"
  ON public.topic_region_research_pages
  FOR SELECT
  USING (true);

-- Seed Bitcoin × Asia as published (using slug lookups).
INSERT INTO public.topic_region_research_pages (topic_keyword_id, region_id, status, published_at)
SELECT k.id, r.id, 'published', now()
FROM public.keyword k, public.regions r
WHERE k.slug = 'bitcoin' AND r.slug = 'asia'
ON CONFLICT (topic_keyword_id, region_id) DO NOTHING;
