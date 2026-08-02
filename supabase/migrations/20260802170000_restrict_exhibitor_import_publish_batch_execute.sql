-- DB-001: exhibitor_import_publish_batch was created with REVOKE FROM PUBLIC +
-- GRANT TO service_role only. Supabase default ACLs still left EXECUTE on
-- anon/authenticated. Restrict via the shared helper (explicit revoke of
-- anon/authenticated — do not rely on REVOKE FROM PUBLIC alone).

SELECT public.__restrict_rpc_execute_to_service_role(
  'public.exhibitor_import_publish_batch(uuid, uuid)'::regprocedure
);
