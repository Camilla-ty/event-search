-- Template: restrict a public RPC to service_role only.
--
-- Supabase/PostgREST may retain EXECUTE on anon and authenticated even after
-- REVOKE FROM PUBLIC. Always revoke explicitly from PUBLIC, anon, and authenticated.
--
-- Usage (replace signature with pg_get_function_identity_arguments output):
--
--   SELECT public.__restrict_rpc_execute_to_service_role(
--     'public.company_merge_preview(uuid, uuid)'::regprocedure
--   );
--
-- Or inline after CREATE OR REPLACE FUNCTION:
--
--   REVOKE ALL ON FUNCTION public.example_rpc(uuid) FROM PUBLIC;
--   REVOKE EXECUTE ON FUNCTION public.example_rpc(uuid) FROM anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.example_rpc(uuid) TO service_role;

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
