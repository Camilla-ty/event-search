import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

export type AppProfileRole = "member" | "admin" | "staff";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

function normalizeRole(raw: unknown): AppProfileRole | null {
  if (raw === "member" || raw === "admin" || raw === "staff") {
    return raw;
  }
  return null;
}

export function isAdminRole(role: AppProfileRole | null): boolean {
  return role === "admin";
}

async function readProfileRoleWithAdmin(userId: string): Promise<AppProfileRole | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return normalizeRole(data?.role);
}

/**
 * Reads profiles.role for server-side authorization.
 *
 * Tries the caller's session first (RLS). If no row is returned (common when
 * profiles RLS policies are missing), falls back to a service-role read for the
 * same user id — only after the caller has already verified identity via getUser().
 */
export async function getProfileRoleForUserId(
  supabase: ServerSupabase,
  userId: string,
): Promise<AppProfileRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!error && data) {
    const role = normalizeRole(data.role);
    if (role) {
      return role;
    }
  }

  return readProfileRoleWithAdmin(userId);
}
