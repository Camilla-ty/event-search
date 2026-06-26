-- Phase 9 (company domain matching): atomic set primary company domain.
-- Updates companies.website, companies.domain, and company_domains.is_primary together.

CREATE OR REPLACE FUNCTION public.set_company_primary_domain(
  p_company_id uuid,
  p_company_domain_id uuid
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

  IF v_domain_row.is_primary THEN
    RETURN jsonb_build_object(
      'status', 'already_primary',
      'company_id', p_company_id,
      'website', v_company.website,
      'domain', v_company.domain,
      'primary_domain_id', p_company_domain_id
    );
  END IF;

  v_new_domain := trim(v_domain_row.domain);

  UPDATE public.companies
  SET
    website = v_new_domain,
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
    'website', v_new_domain,
    'domain', v_new_domain,
    'primary_domain_id', p_company_domain_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_primary_domain(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_company_primary_domain(uuid, uuid) TO service_role;
