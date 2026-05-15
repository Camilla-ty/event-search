-- RLS for public.profiles
--
-- Verified against schema_dump.sql:
--   - RLS already ENABLED on public.profiles
--   - No profiles policies in dump (default deny for anon/authenticated)
--   - GRANT ALL on profiles to anon + authenticated (tightened below)
--   - Profile INSERT only via public.handle_new_user() (SECURITY DEFINER trigger)
--
-- Final behavior:
--   - authenticated: SELECT/UPDATE own row (auth.uid() = id)
--   - anon: no access
--   - client INSERT: denied (no INSERT policy)
--   - trigger insert: unaffected (SECURITY DEFINER bypasses RLS)

-- ---------------------------------------------------------------------------
-- Ensure RLS is on (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Drop legacy or duplicate policies (safe re-run)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- ---------------------------------------------------------------------------
-- Policies: authenticated only, own row
-- ---------------------------------------------------------------------------
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No INSERT policy: clients cannot create profiles.
-- No policies for anon: no SELECT/UPDATE/INSERT/DELETE.

-- ---------------------------------------------------------------------------
-- Privileges: least privilege for client roles; service_role unchanged
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
