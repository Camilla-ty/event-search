import type { AuthCallbackFlow } from "@/src/lib/auth/buildAuthCallbackUrl";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";

export const OAUTH_NEXT_COOKIE = "hs_oauth_next";
export const OAUTH_FLOW_COOKIE = "hs_oauth_flow";

const MAX_AGE_SECONDS = 600;

/** Client: persist post-login redirect before OAuth (keeps redirectTo URL simple). */
export function setOAuthRedirectStateCookies(
  nextPath: string,
  flow: AuthCallbackFlow,
): void {
  const next = safeRedirectTarget(nextPath, "/");
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  document.cookie = `${OAUTH_FLOW_COOKIE}=${flow}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function readOAuthNextFromCookies(
  cookies: { name: string; value: string }[],
  fallback: string,
): string {
  const raw = cookies.find((cookie) => cookie.name === OAUTH_NEXT_COOKIE)?.value;
  if (raw === undefined || raw === "") {
    return safeRedirectTarget(fallback, "/");
  }
  try {
    return safeRedirectTarget(decodeURIComponent(raw), "/");
  } catch {
    return safeRedirectTarget(fallback, "/");
  }
}

export function readOAuthFlowFromCookies(
  cookies: { name: string; value: string }[],
  fallback: AuthCallbackFlow,
): AuthCallbackFlow {
  const raw = cookies.find((cookie) => cookie.name === OAUTH_FLOW_COOKIE)?.value;
  if (raw === "login") {
    return "login";
  }
  if (raw === "signup") {
    return "signup";
  }
  return fallback;
}

export function clearOAuthRedirectStateOnResponse(
  response: { cookies: { set: (name: string, value: string, options?: { maxAge?: number; path?: string }) => void } },
): void {
  const clear = { maxAge: 0, path: "/" };
  response.cookies.set(OAUTH_NEXT_COOKIE, "", clear);
  response.cookies.set(OAUTH_FLOW_COOKIE, "", clear);
}

export function isSupabaseGoogleExchangeError(message: string): boolean {
  return message.toLowerCase().includes("unable to exchange external code");
}
