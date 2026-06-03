import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeAuthEmail } from "@/src/lib/auth/normalizeAuthEmail";
import { createAdminClient } from "@/src/lib/supabase/admin";

type AdminClient = SupabaseClient;

const RPC_FUNCTION = "auth_user_exists_by_email";

function isMissingRpcError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find the function") ||
    lower.includes("schema cache") ||
    lower.includes("pgrst202")
  );
}

async function authUserExistsViaRpc(
  admin: AdminClient,
  email: string,
): Promise<{ exists: boolean; error: string | null; missingRpc: boolean }> {
  const { data, error } = await admin.rpc(RPC_FUNCTION, {
    p_email: email,
  });

  if (error) {
    if (isMissingRpcError(error.message)) {
      return { exists: false, error: null, missingRpc: true };
    }
    return { exists: false, error: error.message, missingRpc: false };
  }

  return { exists: data === true, error: null, missingRpc: false };
}

/** Fast path when public.profiles has a row for this email (service role). */
async function authUserExistsViaProfiles(
  admin: AdminClient,
  email: string,
): Promise<{ exists: boolean; error: string | null }> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .limit(1);

  if (error) {
    return { exists: false, error: error.message };
  }

  return { exists: Array.isArray(data) && data.length > 0, error: null };
}

/**
 * Fallback when RPC is not deployed: scan auth.users via Admin API (paginated).
 */
async function authUserExistsViaAuthAdminList(
  admin: AdminClient,
  email: string,
): Promise<{ exists: boolean; error: string | null }> {
  const perPage = 1000;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      return { exists: false, error: error.message };
    }

    const users = data.users;
    const matched = users.some(
      (user) =>
        typeof user.email === "string" &&
        user.email.trim().toLowerCase() === email,
    );
    if (matched) {
      return { exists: true, error: null };
    }

    if (users.length < perPage) {
      return { exists: false, error: null };
    }
  }

  return {
    exists: false,
    error: "Could not verify account (user list limit reached).",
  };
}

/**
 * Whether an auth.users row exists for this email (service role only).
 * Uses RPC when deployed; otherwise profiles + Auth Admin listUsers.
 */
export async function checkAuthUserExistsByEmail(
  rawEmail: string,
): Promise<{ exists: boolean; email: string | null; error: string | null }> {
  const email = normalizeAuthEmail(rawEmail);
  if (!email) {
    return { exists: false, email: null, error: "Email is required." };
  }

  try {
    const admin = createAdminClient();

    const rpcResult = await authUserExistsViaRpc(admin, email);
    if (!rpcResult.missingRpc) {
      if (rpcResult.error) {
        return { exists: false, email, error: rpcResult.error };
      }
      return { exists: rpcResult.exists, email, error: null };
    }

    const [profileResult, authListResult] = await Promise.all([
      authUserExistsViaProfiles(admin, email),
      authUserExistsViaAuthAdminList(admin, email),
    ]);

    if (profileResult.exists || authListResult.exists) {
      return { exists: true, email, error: null };
    }

    if (authListResult.error) {
      return { exists: false, email, error: authListResult.error };
    }

    if (profileResult.error) {
      return { exists: false, email, error: profileResult.error };
    }

    return { exists: false, email, error: null };
  } catch (caught) {
    const message =
      caught instanceof Error && caught.message.trim() !== ""
        ? caught.message.trim()
        : "Could not verify account.";
    return { exists: false, email, error: message };
  }
}
