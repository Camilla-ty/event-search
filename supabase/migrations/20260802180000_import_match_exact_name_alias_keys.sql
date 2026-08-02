-- ARC-003 Phase 2: exact alias-key lookup for import match candidate loading.
-- Replaces the previous broad scan of all active companies with non-empty aliases.
-- Exact match on lower(trim(alias)) — NOT substring (distinct from admin_company_ids_matching_alias).
-- Executable by service_role only (createAdminClient).

CREATE OR REPLACE FUNCTION public.import_match_company_ids_by_exact_alias_keys(
  p_keys text[]
)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH keys AS (
    SELECT DISTINCT lower(trim(k)) AS name_key
    FROM unnest(coalesce(p_keys, '{}'::text[])) AS k
    WHERE nullif(trim(k), '') IS NOT NULL
  )
  SELECT DISTINCT c.id
  FROM public.companies c
  INNER JOIN LATERAL unnest(coalesce(c.aliases, '{}'::text[])) AS a(alias) ON true
  INNER JOIN keys ON keys.name_key = lower(trim(a.alias))
  WHERE c.status = 'active'
    AND nullif(trim(a.alias), '') IS NOT NULL
  ORDER BY c.id;
$$;

COMMENT ON FUNCTION public.import_match_company_ids_by_exact_alias_keys(text[]) IS
  'ARC-003 import match candidate helper: active company ids whose aliases exactly '
  'match any of p_keys (case-insensitive trim). Service_role only. '
  'Not for admin substring search — use admin_company_ids_matching_alias for that.';

SELECT public.__restrict_rpc_execute_to_service_role(
  'public.import_match_company_ids_by_exact_alias_keys(text[])'::regprocedure
);

-- Exact canonical-name keys (same normalizeCompanyNameKey semantics) for candidate loading.
CREATE OR REPLACE FUNCTION public.import_match_company_ids_by_exact_name_keys(
  p_keys text[]
)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH keys AS (
    SELECT DISTINCT lower(trim(k)) AS name_key
    FROM unnest(coalesce(p_keys, '{}'::text[])) AS k
    WHERE nullif(trim(k), '') IS NOT NULL
  )
  SELECT c.id
  FROM public.companies c
  INNER JOIN keys ON keys.name_key = lower(trim(c.name))
  WHERE c.status = 'active'
  ORDER BY c.id;
$$;

COMMENT ON FUNCTION public.import_match_company_ids_by_exact_name_keys(text[]) IS
  'ARC-003 import match candidate helper: active company ids whose canonical name '
  'exactly matches any of p_keys (case-insensitive trim). Service_role only.';

SELECT public.__restrict_rpc_execute_to_service_role(
  'public.import_match_company_ids_by_exact_name_keys(text[])'::regprocedure
);
