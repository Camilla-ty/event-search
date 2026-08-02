/*
  DB-001 verification — run after applying
  20260802170000_restrict_exhibitor_import_publish_batch_execute.sql

  Expected for public.exhibitor_import_publish_batch(uuid, uuid):
    - anon EXECUTE = false
    - authenticated EXECUTE = false
    - service_role EXECUTE = true

  Usage:
    supabase db query --linked -f supabase/verify/exhibitor_import_publish_batch_execute_grants.sql
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
  AND p.proname = 'exhibitor_import_publish_batch'
  AND pg_get_function_identity_arguments(p.oid) = 'p_batch_id uuid, p_published_by uuid';
