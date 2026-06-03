import type { ReadonlyURLSearchParams } from "next/navigation";

import { resolveOAuthErrorFromQuery } from "@/src/lib/auth/resolveOAuthError";
import { resolvePostAuthRedirect } from "@/src/lib/auth/resolvePostAuthRedirect";

export type AuthEntrySearchParams = {
  redirectTo: string;
  email: string | null;
  notice: string | null;
  oauthError: ReturnType<typeof resolveOAuthErrorFromQuery>;
};

/**
 * Shared parsing for /login and /signup query strings.
 */
export function readAuthEntrySearchParams(
  searchParams: Pick<ReadonlyURLSearchParams, "get">,
  redirectFallback = "/",
): AuthEntrySearchParams {
  const emailRaw = searchParams.get("email");
  const email =
    typeof emailRaw === "string" && emailRaw.trim() !== ""
      ? emailRaw.trim()
      : null;

  const noticeRaw = searchParams.get("notice");
  const notice =
    typeof noticeRaw === "string" && noticeRaw.trim() !== ""
      ? noticeRaw.trim()
      : null;

  return {
    redirectTo: resolvePostAuthRedirect(
      searchParams.get("redirect"),
      redirectFallback,
    ),
    email,
    notice,
    oauthError: resolveOAuthErrorFromQuery(searchParams.get("error")),
  };
}
