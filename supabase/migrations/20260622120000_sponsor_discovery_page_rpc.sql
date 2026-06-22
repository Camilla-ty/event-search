-- Phase 1 PR1 — Global sponsor discovery read RPC
--
-- Returns distinct companies that have at least one RLS-visible event_sponsors row,
-- with optional text search, optional event-edition slug filter, sort, and pagination.
--
-- SECURITY INVOKER: event_sponsors RLS applies (anon tier_rank=1 only; authenticated all tiers).
-- No SECURITY DEFINER. No silent default event edition.
--
-- ---------------------------------------------------------------------------
-- Response JSON shape (top level)
-- ---------------------------------------------------------------------------
-- {
--   "rows": SponsorDiscoveryRpcRow[],
--   "total": number,              -- count of eligible companies after filters (before page slice)
--   "page": number,               -- effective page (>= 1)
--   "page_size": number,          -- effective page size (1..100, default 20)
--   "sort": string,               -- effective sort: activity | name | count | tier
--   "event_unknown": boolean,     -- true when p_event_slug provided but edition not found
--   "event": null | {             -- null when no p_event_slug; partial when event_unknown
--     "slug": string,
--     "id"?: uuid,                -- present when edition resolved
--     "name"?: string             -- present when edition resolved
--   }
-- }
--
-- SponsorDiscoveryRpcRow {
--   "id": uuid,
--   "name": string,
--   "slug": string,
--   "domain": string | null,
--   "website": string | null,
--   "logo_url": string | null,
--   "logo_source": string | null,
--   "logo_status": string | null,
--   "short_description": string | null,
--   "sponsored_edition_count": number,
--   "latest_activity_at": string | null,  -- ISO date (event_editions.start_date)
--   "tier_rank": number | null,           -- set only when event slug resolved
--   "tier_label": string | null           -- set only when event slug resolved
-- }

-- Supports GROUP BY company_id in sponsor_discovery_page().
CREATE INDEX IF NOT EXISTS event_sponsors_company_id_idx
  ON public.event_sponsors (company_id);

CREATE OR REPLACE FUNCTION public.sponsor_discovery_page(
  p_query text DEFAULT NULL,
  p_event_slug text DEFAULT NULL,
  p_sort text DEFAULT 'activity',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      nullif(trim(coalesce(p_query, '')), '') AS query_term,
      nullif(trim(coalesce(p_event_slug, '')), '') AS event_slug,
      CASE
        WHEN nullif(trim(coalesce(p_sort, '')), '') IS NULL THEN 'activity'
        WHEN lower(trim(p_sort)) NOT IN ('activity', 'name', 'count', 'tier') THEN 'activity'
        ELSE lower(trim(p_sort))
      END AS raw_sort,
      greatest(coalesce(p_page, 1), 1) AS page,
      least(greatest(coalesce(p_page_size, 20), 1), 100) AS page_size
  ),
  resolved_event AS (
    SELECT ee.id, ee.slug, ee.name
    FROM params p
    INNER JOIN public.event_editions ee ON ee.slug = p.event_slug
    WHERE p.event_slug IS NOT NULL
  ),
  params2 AS (
    SELECT
      p.query_term,
      p.event_slug,
      p.page,
      p.page_size,
      (
        p.event_slug IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM resolved_event)
      ) AS event_unknown,
      CASE
        WHEN p.event_slug IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM resolved_event) THEN 'activity'
        WHEN p.raw_sort = 'tier' AND p.event_slug IS NULL THEN 'activity'
        ELSE p.raw_sort
      END AS effective_sort
    FROM params p
  ),
  visible_links AS (
    SELECT
      es.company_id,
      es.event_editions_id,
      es.tier_rank,
      es.tier_label,
      ee.start_date,
      ee.slug AS edition_slug
    FROM public.event_sponsors es
    INNER JOIN public.event_editions ee ON ee.id = es.event_editions_id
  ),
  filtered_links AS (
    SELECT vl.*
    FROM visible_links vl
    CROSS JOIN params2 p
    WHERE NOT p.event_unknown
      AND (
        p.event_slug IS NULL
        OR vl.edition_slug = p.event_slug
      )
  ),
  company_stats AS (
    SELECT
      fl.company_id,
      count(DISTINCT fl.event_editions_id)::integer AS sponsored_edition_count,
      max(fl.start_date) AS latest_activity_at
    FROM filtered_links fl
    GROUP BY fl.company_id
  ),
  event_context AS (
    SELECT DISTINCT ON (fl.company_id)
      fl.company_id,
      fl.tier_rank,
      fl.tier_label
    FROM filtered_links fl
    CROSS JOIN params2 p
    WHERE p.event_slug IS NOT NULL
      AND NOT p.event_unknown
    ORDER BY
      fl.company_id,
      fl.tier_rank ASC NULLS LAST,
      fl.tier_label ASC NULLS LAST
  ),
  eligible AS (
    SELECT
      c.id,
      c.name,
      c.slug,
      c.domain,
      c.website,
      c.logo_url,
      c.logo_source,
      c.logo_status,
      c.short_description,
      cs.sponsored_edition_count,
      cs.latest_activity_at,
      ec.tier_rank,
      ec.tier_label
    FROM company_stats cs
    INNER JOIN public.companies c ON c.id = cs.company_id
    LEFT JOIN event_context ec ON ec.company_id = c.id
    CROSS JOIN params2 p
    WHERE
      p.query_term IS NULL
      OR c.name ILIKE '%' || p.query_term || '%'
      OR c.slug ILIKE '%' || p.query_term || '%'
      OR coalesce(c.domain, '') ILIKE '%' || p.query_term || '%'
      OR coalesce(c.website, '') ILIKE '%' || p.query_term || '%'
      OR EXISTS (
        SELECT 1
        FROM unnest(coalesce(c.aliases, '{}'::text[])) AS a(alias)
        WHERE a.alias ILIKE '%' || p.query_term || '%'
      )
  ),
  total_count AS (
    SELECT count(*)::integer AS total
    FROM eligible
  ),
  paged AS (
    SELECT e.*
    FROM eligible e
    CROSS JOIN params2 p
    ORDER BY
      CASE WHEN p.effective_sort = 'activity' THEN e.latest_activity_at END DESC NULLS LAST,
      CASE WHEN p.effective_sort = 'count' THEN e.sponsored_edition_count END DESC NULLS LAST,
      CASE WHEN p.effective_sort = 'tier' THEN e.tier_rank END ASC NULLS LAST,
      CASE WHEN p.effective_sort = 'tier' THEN e.tier_label END ASC NULLS LAST,
      CASE WHEN p.effective_sort = 'name' THEN e.name END ASC NULLS LAST,
      e.name ASC,
      e.id ASC
    OFFSET (SELECT greatest((p2.page - 1) * p2.page_size, 0) FROM params2 p2)
    LIMIT (SELECT p2.page_size FROM params2 p2)
  ),
  rows_json AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', pg.id,
          'name', pg.name,
          'slug', pg.slug,
          'domain', pg.domain,
          'website', pg.website,
          'logo_url', pg.logo_url,
          'logo_source', pg.logo_source,
          'logo_status', pg.logo_status,
          'short_description', pg.short_description,
          'sponsored_edition_count', pg.sponsored_edition_count,
          'latest_activity_at', pg.latest_activity_at,
          'tier_rank', pg.tier_rank,
          'tier_label', pg.tier_label
        )
        ORDER BY
          CASE WHEN (SELECT effective_sort FROM params2) = 'activity' THEN pg.latest_activity_at END DESC NULLS LAST,
          CASE WHEN (SELECT effective_sort FROM params2) = 'count' THEN pg.sponsored_edition_count END DESC NULLS LAST,
          CASE WHEN (SELECT effective_sort FROM params2) = 'tier' THEN pg.tier_rank END ASC NULLS LAST,
          CASE WHEN (SELECT effective_sort FROM params2) = 'tier' THEN pg.tier_label END ASC NULLS LAST,
          CASE WHEN (SELECT effective_sort FROM params2) = 'name' THEN pg.name END ASC NULLS LAST,
          pg.name ASC,
          pg.id ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM paged pg
  )
  SELECT jsonb_build_object(
    'rows', (SELECT rows FROM rows_json),
    'total', (SELECT total FROM total_count),
    'page', (SELECT page FROM params2),
    'page_size', (SELECT page_size FROM params2),
    'sort', (SELECT effective_sort FROM params2),
    'event_unknown', (SELECT event_unknown FROM params2),
    'event',
      CASE
        WHEN (SELECT event_slug FROM params2) IS NULL THEN NULL
        WHEN (SELECT event_unknown FROM params2) THEN jsonb_build_object(
          'slug', (SELECT event_slug FROM params2)
        )
        ELSE (
          SELECT jsonb_build_object(
            'id', re.id,
            'slug', re.slug,
            'name', re.name
          )
          FROM resolved_event re
        )
      END
  );
$$;

COMMENT ON FUNCTION public.sponsor_discovery_page(text, text, text, integer, integer) IS
  'Global sponsor discovery page: distinct sponsored companies with search, optional event slug filter, sort, pagination. SECURITY INVOKER (RLS on event_sponsors). Returns JSON — see migration 20260622120000 header comment for schema.';

REVOKE ALL ON FUNCTION public.sponsor_discovery_page(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sponsor_discovery_page(text, text, text, integer, integer) TO anon, authenticated;
