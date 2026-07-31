-- SCALE-001: bounded admin alias search — never load all active companies for alias match.
-- Mirrors sponsor_discovery_page unnest(aliases) ILIKE semantics (bidirectional substring).
-- Executable by service_role only (createAdminClient).

CREATE OR REPLACE FUNCTION public.admin_company_ids_matching_alias(
  p_term text,
  p_limit integer DEFAULT 1000
)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      nullif(trim(coalesce(p_term, '')), '') AS term,
      least(greatest(coalesce(p_limit, 1000), 1), 1000) AS lim
  ),
  prepared AS (
    SELECT
      p.term,
      p.lim,
      replace(replace(replace(lower(p.term), '\', '\\'), '%', '\%'), '_', '\_') AS term_lit
    FROM params p
    WHERE p.term IS NOT NULL
  )
  SELECT c.id
  FROM public.companies c
  CROSS JOIN prepared p
  WHERE c.status = 'active'
    AND cardinality(coalesce(c.aliases, '{}'::text[])) > 0
    AND EXISTS (
      SELECT 1
      FROM unnest(c.aliases) AS a(alias)
      WHERE nullif(trim(a.alias), '') IS NOT NULL
        AND (
          lower(trim(a.alias)) LIKE '%' || p.term_lit || '%' ESCAPE '\'
          OR lower(p.term) LIKE '%' || replace(
            replace(replace(lower(trim(a.alias)), '\', '\\'), '%', '\%'),
            '_',
            '\_'
          ) || '%' ESCAPE '\'
        )
    )
  ORDER BY c.name ASC
  LIMIT (SELECT lim FROM prepared);
$$;

COMMENT ON FUNCTION public.admin_company_ids_matching_alias(text, integer) IS
  'Admin alias search helper (SCALE-001): returns active company ids whose aliases '
  'match p_term (case-insensitive bidirectional substring). Bounded by p_limit (max 1000). '
  'Called via service_role only.';

SELECT public.__restrict_rpc_execute_to_service_role(
  'public.admin_company_ids_matching_alias(text, integer)'::regprocedure
);
