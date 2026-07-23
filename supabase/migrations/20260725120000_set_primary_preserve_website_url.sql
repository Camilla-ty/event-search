-- Company Identity Phase 1: Set Primary must not replace companies.website
-- with the normalized match-key string. Optional p_website supplies the verified
-- Primary URL (full URL). When omitted, reconstruct https://{domain}.
-- App computes p_website via primaryWebsiteForIdentityPromotion().

DROP FUNCTION IF EXISTS public.set_company_primary_domain(uuid, uuid);

CREATE OR REPLACE FUNCTION public.set_company_primary_domain(
  p_company_id uuid,
  p_company_domain_id uuid,
  p_website text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies%ROWTYPE;
  v_domain_row public.company_domains%ROWTYPE;
  v_new_domain text;
  v_new_website text;
BEGIN
  SELECT * INTO v_company
  FROM public.companies
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company_not_found';
  END IF;

  IF v_company.status IS DISTINCT FROM 'active'::public.company_status
     OR v_company.merged_into_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'merged_read_only';
  END IF;

  SELECT * INTO v_domain_row
  FROM public.company_domains
  WHERE id = p_company_domain_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'domain_not_found';
  END IF;

  v_new_domain := trim(v_domain_row.domain);
  v_new_website := NULLIF(trim(COALESCE(p_website, '')), '');

  IF v_new_website IS NULL THEN
    v_new_website := 'https://' || v_new_domain;
  ELSIF v_new_website !~* '^https?://' THEN
    v_new_website := 'https://' || v_new_website;
  END IF;

  -- Never persist the raw match key as website (no scheme / not a navigable URL).
  IF lower(trim(v_new_website)) = lower(v_new_domain) THEN
    v_new_website := 'https://' || v_new_domain;
  END IF;

  IF v_domain_row.is_primary THEN
    UPDATE public.companies
    SET
      domain = v_new_domain,
      website = v_new_website
    WHERE id = p_company_id
      AND (
        v_company.domain IS DISTINCT FROM v_new_domain
        OR v_company.website IS DISTINCT FROM v_new_website
      );

    SELECT * INTO v_company
    FROM public.companies
    WHERE id = p_company_id;

    RETURN jsonb_build_object(
      'status', 'already_primary',
      'company_id', p_company_id,
      'website', v_company.website,
      'domain', v_company.domain,
      'primary_domain_id', p_company_domain_id
    );
  END IF;

  UPDATE public.companies
  SET
    website = v_new_website,
    domain = v_new_domain
  WHERE id = p_company_id;

  UPDATE public.company_domains
  SET is_primary = false
  WHERE company_id = p_company_id;

  UPDATE public.company_domains
  SET is_primary = true
  WHERE id = p_company_domain_id;

  RETURN jsonb_build_object(
    'status', 'updated',
    'company_id', p_company_id,
    'website', v_new_website,
    'domain', v_new_domain,
    'primary_domain_id', p_company_domain_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_primary_domain(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_company_primary_domain(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_primary_domain(uuid, uuid, text) TO service_role;

-- Supabase may retain EXECUTE on anon/authenticated after CREATE OR REPLACE;
-- use the shared helper so grants match protection-v1 (service_role only).
SELECT public.__restrict_rpc_execute_to_service_role(
  'public.set_company_primary_domain(uuid, uuid, text)'::regprocedure
);
