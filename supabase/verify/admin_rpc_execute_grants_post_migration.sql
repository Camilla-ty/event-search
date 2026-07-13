/*
  Admin RPC execute grant verification — run after applying
  20260718120000_revoke_admin_rpc_execute_from_public_roles.sql

  Expected:
    - has_function_privilege('anon', ...) = false for admin/internal RPCs
    - has_function_privilege('authenticated', ...) = false
    - has_function_privilege('service_role', ...) = true
*/

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND (
    p.proname IN (
      'company_merge_preview',
      'merge_companies',
      'sponsor_import_publish_batch',
      'set_company_primary_domain'
    )
    OR p.proname LIKE '\_company_merge\_%' ESCAPE '\'
  )
ORDER BY p.proname, args;
