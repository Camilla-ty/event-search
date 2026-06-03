import {
  readOAuthFlowFromCookies,
  readOAuthNextFromCookies,
} from "@/src/lib/auth/oauthRedirectState";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";

export type AuthCallbackFlow = "signup" | "login";

/**
 * OAuth redirect target for Supabase signInWithOAuth (PKCE → /auth/callback).
 * Query-free URL so it matches Supabase redirect allowlists exactly;
 * `next` and `flow` are stored in short-lived cookies via setOAuthRedirectStateCookies.
 */
export function buildAuthCallbackUrl(origin: string): string {
  return new URL("/auth/callback", origin).toString();
}

/** Resolve post-login redirect from cookies, with query-param fallback for legacy URLs. */
export function parseAuthCallbackQuery(
  searchParams: URLSearchParams,
  cookies: { name: string; value: string }[],
): { next: string; flow: AuthCallbackFlow } {
  const nextFromQuery = searchParams.get("next");
  const flowFromQuery = searchParams.get("flow");

  return {
    next: readOAuthNextFromCookies(
      cookies,
      nextFromQuery !== null ? safeRedirectTarget(nextFromQuery, "/") : "/",
    ),
    flow:
      flowFromQuery === "login"
        ? "login"
        : readOAuthFlowFromCookies(cookies, "signup"),
  };
}
