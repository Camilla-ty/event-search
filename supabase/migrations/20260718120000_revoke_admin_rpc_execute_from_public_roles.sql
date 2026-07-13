-- Emergency hotfix: admin/internal SECURITY DEFINER RPCs were executable by anon/authenticated.
-- Live verification (2026-07-13): PostgREST accepted anon + member JWT for these functions.
-- REVOKE FROM PUBLIC alone is insufficient; revoke anon/authenticated explicitly.

CREATE OR REPLACE FUNCTION public.__restrict_rpc_execute_to_service_role(p_proc regprocedure)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', p_proc);
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', p_proc);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', p_proc);
END;
$$;

REVOKE ALL ON FUNCTION public.__restrict_rpc_execute_to_service_role(regprocedure) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.__restrict_rpc_execute_to_service_role(regprocedure) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__restrict_rpc_execute_to_service_role(regprocedure) TO service_role;

DO $hotfix$
DECLARE
  v_proc regprocedure;
  v_procs regprocedure[] := ARRAY[
    'public.company_merge_preview(uuid, uuid)'::regprocedure,
    'public.merge_companies(uuid, uuid, uuid, jsonb, text)'::regprocedure,
    'public.sponsor_import_publish_batch(uuid, uuid)'::regprocedure,
    'public.set_company_primary_domain(uuid, uuid)'::regprocedure,
    'public._company_merge_assert_preconditions(uuid, uuid, boolean, uuid)'::regprocedure,
    'public._company_merge_build_preview(uuid, uuid)'::regprocedure,
    'public._company_merge_company_row_json(uuid)'::regprocedure,
    'public._company_merge_company_snapshot(uuid)'::regprocedure,
    'public._company_merge_default_field_resolutions()'::regprocedure,
    'public._company_merge_draft_link_strategy(jsonb, uuid)'::regprocedure,
    'public._company_merge_duplicate_has_dependencies(uuid)'::regprocedure,
    'public._company_merge_logo_score(text, text, text)'::regprocedure,
    'public._company_merge_merge_aliases(text, text[], text, text[])'::regprocedure,
    'public._company_merge_name_key(text)'::regprocedure,
    'public._company_merge_organizer_strategy(jsonb, uuid)'::regprocedure,
    'public._company_merge_pick_text_field(text, text, text)'::regprocedure,
    'public._company_merge_process_organizers(uuid, uuid, jsonb, jsonb)'::regprocedure,
    'public._company_merge_process_partner_alumni(uuid, uuid, jsonb)'::regprocedure,
    'public._company_merge_sponsorship_strategy(jsonb, uuid)'::regprocedure,
    'public._company_merge_tombstone_slug(uuid)'::regprocedure,
    'public._company_merge_validate_resolutions(jsonb, jsonb)'::regprocedure
  ];
BEGIN
  FOREACH v_proc IN ARRAY v_procs
  LOOP
    PERFORM public.__restrict_rpc_execute_to_service_role(v_proc);
  END LOOP;
END;
$hotfix$;
