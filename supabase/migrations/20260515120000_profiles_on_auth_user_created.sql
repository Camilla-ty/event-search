-- Auto-create public.profiles when a row is inserted into auth.users.
--
-- Verified against schema_dump.sql (source of truth):
--   - public.profiles: PK (id), FK profiles_id_fkey -> auth.users(id) ON DELETE CASCADE
--   - Columns: id, created_at, email, display_name, role (CHECK: member | admin | staff)
--   - No existing triggers or handle_new_user function in dump
--   - profiles.id must equal auth.users.id (not gen_random_uuid default)

-- ---------------------------------------------------------------------------
-- Function: insert profile on auth.users INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'display_name',
    'member'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates a public.profiles row after auth.users insert. Idempotent via ON CONFLICT DO NOTHING.';

-- Restrict direct invocation; only the trigger should call this function.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: AFTER INSERT on auth.users
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
