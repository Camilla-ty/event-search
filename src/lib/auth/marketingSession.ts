import { createClient } from "@/src/lib/supabase/server";
import {
  getProfileRoleForUserId,
  isAdminRole,
  type AppProfileRole,
} from "@/src/lib/auth/appProfile";

export type MarketingNavSession = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  role: AppProfileRole | null;
  label: string | null;
  email: string | null;
};

export const LOGGED_OUT_NAV_SESSION: MarketingNavSession = {
  isAuthenticated: false,
  isAdmin: false,
  role: null,
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
    return LOGGED_OUT_NAV_SESSION;
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

  const role = await getProfileRoleForUserId(supabase, user.id);
  const label = displayName ?? email;
  const isAdmin = isAdminRole(role);

  return {
    isAuthenticated: true,
    isAdmin,
    role,
    label,
    email,
  };
}
