-- Event edition Sponsor Search v1 (scope: docs/phase-sponsor-search-scope.md).
-- Authenticated-only. SECURITY INVOKER so event_sponsors RLS remains the DB boundary
-- (authenticated may read all tiers). Verified-domain matches reuse
-- __company_matches_verified_domain_search (boolean only; no SELECT grant on
-- company_domains; no new EXECUTE grants on that helper). At most 20 rows;
-- no aggregate count or paging fields.

CREATE OR REPLACE FUNCTION public.event_edition_sponsor_search(
  p_edition_id uuid,
  p_query text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      CASE
        WHEN nullif(trim(coalesce(p_query, '')), '') IS NULL THEN NULL
        WHEN char_length(trim(p_query)) > 200 THEN NULL
        WHEN char_length(trim(p_query)) < 3 THEN NULL
        ELSE trim(p_query)
      END AS term
  ),
  matched AS (
    SELECT
      es.id AS link_id,
      es.company_id,
      es.tier_rank,
      es.tier_label,
      es.display_order,
      c.id AS company_id_out,
      c.name AS company_name,
      c.slug AS company_slug,
      c.domain AS company_domain,
      c.website AS company_website,
      c.logo_url AS company_logo_url,
      c.logo_source AS company_logo_source,
      c.logo_status AS company_logo_status,
      c.restricted_at AS company_restricted_at
    FROM public.event_sponsors es
    INNER JOIN public.companies c
      ON c.id = es.company_id
    CROSS JOIN q
    WHERE es.event_editions_id = p_edition_id
      AND q.term IS NOT NULL
      AND (
        c.name ILIKE '%' || q.term || '%'
        OR coalesce(c.domain, '') ILIKE '%' || q.term || '%'
        OR coalesce(c.website, '') ILIKE '%' || q.term || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(c.aliases, '{}'::text[])) AS a(alias)
          WHERE a.alias ILIKE '%' || q.term || '%'
        )
        OR public.__company_matches_verified_domain_search(c.id, q.term)
      )
    ORDER BY
      es.tier_rank ASC NULLS LAST,
      es.display_order ASC NULLS LAST,
      es.id ASC
    LIMIT 20
  )
  SELECT coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.link_id,
          'company_id', m.company_id,
          'tier_rank', m.tier_rank,
          'tier_label', m.tier_label,
          'display_order', m.display_order,
          'company', jsonb_build_object(
            'id', m.company_id_out,
            'name', m.company_name,
            'slug', m.company_slug,
            'domain', m.company_domain,
            'website', m.company_website,
            'logo_url', m.company_logo_url,
            'logo_source', m.company_logo_source,
            'logo_status', m.company_logo_status,
            'restricted_at', m.company_restricted_at
          )
        )
        ORDER BY
          m.tier_rank ASC NULLS LAST,
          m.display_order ASC NULLS LAST,
          m.link_id ASC
      )
      FROM matched m
    ),
    '[]'::jsonb
  );
$$;

COMMENT ON FUNCTION public.event_edition_sponsor_search(uuid, text) IS
  'Authenticated-only edition-scoped sponsor search for the Sponsors tab. SECURITY INVOKER (RLS). '
  'Matches name/domain/website/aliases/verified domains. Max 20 rows; no count or paging fields. '
  'Callers must scrub restricted company fields in the application public mapper.';

REVOKE ALL ON FUNCTION public.event_edition_sponsor_search(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.event_edition_sponsor_search(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.event_edition_sponsor_search(uuid, text)
  TO authenticated, service_role;
