import { isSupabaseGoogleExchangeError } from "@/src/lib/auth/oauthRedirectState";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";

export type ResolvedOAuthError = {
  /** User-facing message (decoded from ?error=). */
  message: string;
  /** Raw value from the query string before normalization. */
  raw: string;
  showProviderHelp: boolean;
};

function decodeOAuthErrorParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Normalizes OAuth callback errors passed via ?error= on login/signup entry URLs.
 */
/** Normalizes an in-component OAuth error (e.g. GoogleAuthButton). */
export function resolveOAuthErrorFromMessage(
  message: string | null | undefined,
): ResolvedOAuthError | null {
  const trimmed = typeof message === "string" ? message.trim() : "";
  if (trimmed === "") {
    return null;
  }
  return {
    message: trimmed,
    raw: trimmed,
    showProviderHelp: isSupabaseGoogleExchangeError(trimmed),
  };
}

export function resolveOAuthErrorFromQuery(
  errorParam: string | null | undefined,
): ResolvedOAuthError | null {
  const raw = typeof errorParam === "string" ? errorParam.trim() : "";
  if (raw === "") {
    return null;
  }

  const message = decodeOAuthErrorParam(raw);
  return {
    message,
    raw,
    showProviderHelp: isSupabaseGoogleExchangeError(message),
  };
}

export type AuthEntryPath = "/login" | "/signup";

/**
 * Builds a login/signup entry URL with a normalized OAuth error query param.
 * Used by /auth/callback error redirects (flow unchanged; encoding hardened).
 */
export function buildAuthEntryUrlWithOAuthError(
  entryPath: AuthEntryPath,
  redirectTo: string,
  message: string,
): string {
  const url = new URL(entryPath, "http://local");
  url.searchParams.set("redirect", safeRedirectTarget(redirectTo, "/"));
  url.searchParams.set("error", encodeURIComponent(message.trim()));
  return `${url.pathname}${url.search}`;
}
