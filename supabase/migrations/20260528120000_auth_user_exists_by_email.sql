-- Server-only helper: check whether auth.users already has this email.
-- Used by /api/auth/check-email to separate login (existing) vs signup (new).
--
-- Optional for performance: the app falls back to profiles + Auth Admin API
-- when this function is not deployed. Apply this migration in production to
-- avoid paginated auth.admin.listUsers scans.

CREATE OR REPLACE FUNCTION public.auth_user_exists_by_email(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(trim(email)) = lower(trim(p_email))
  );
$$;

COMMENT ON FUNCTION public.auth_user_exists_by_email(text) IS
  'Returns true when an auth.users row exists for the email. Callable by service_role only.';

REVOKE ALL ON FUNCTION public.auth_user_exists_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_exists_by_email(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_exists_by_email(text) TO service_role;
