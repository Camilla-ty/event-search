-- Company Identity Phase 1 follow-up: CREATE OR REPLACE on
-- set_company_primary_domain(uuid, uuid, text) re-granted EXECUTE to
-- anon/authenticated (Supabase default ACL drift). Restrict to service_role.

SELECT public.__restrict_rpc_execute_to_service_role(
  'public.set_company_primary_domain(uuid, uuid, text)'::regprocedure
);
