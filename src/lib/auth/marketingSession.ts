import { createClient } from "@/src/lib/supabase/server";

export type MarketingNavSession = {
  isAuthenticated: boolean;
  label: string | null;
  email: string | null;
};

const loggedOut: MarketingNavSession = {
  isAuthenticated: false,
  label: null,
  email: null,
};

/**
 * Server session snapshot for marketing chrome (nav / header).
 * Uses getUser() + optional profiles row for display_name.
 */
export async function getMarketingNavSession(): Promise<MarketingNavSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return loggedOut;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const email =
    (typeof user.email === "string" && user.email.trim() !== ""
      ? user.email.trim()
      : null) ??
    (typeof profile?.email === "string" && profile.email.trim() !== ""
      ? profile.email.trim()
      : null);

  const displayName =
    typeof profile?.display_name === "string" && profile.display_name.trim() !== ""
      ? profile.display_name.trim()
      : null;

  const label = displayName ?? email;

  return {
    isAuthenticated: true,
    label,
    email,
  };
}
