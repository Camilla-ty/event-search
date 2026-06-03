-- Map Google/OAuth metadata into profiles.display_name on signup.
-- Email OTP signup leaves display_name null (onboarding later); Google uses full_name or name.

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
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'display_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), '')
    ),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
