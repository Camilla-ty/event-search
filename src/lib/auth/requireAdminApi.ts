import { NextResponse } from "next/server";

import { getProfileRoleForUserId, isAdminRole } from "@/src/lib/auth/appProfile";
import { createClient } from "@/src/lib/supabase/server";

export type AdminApiContext = {
  userId: string;
};

type RequireAdminResult =
  | { ok: true; context: AdminApiContext }
  | { ok: false; response: NextResponse };

export async function requireAdminApi(): Promise<RequireAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  const role = await getProfileRoleForUserId(supabase, user.id);
  if (!isAdminRole(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Forbidden." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, context: { userId: user.id } };
}
