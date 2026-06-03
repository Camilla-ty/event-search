import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";

export type AuthEntryPath = "/login" | "/signup";

/** Query params consumed on the client and stripped from the address bar. */
export const AUTH_ENTRY_TRANSIENT_QUERY_KEYS = [
  "error",
  "notice",
  "email",
] as const;

export function authEntryHasTransientQuery(
  searchParams: Pick<URLSearchParams, "has">,
): boolean {
  return AUTH_ENTRY_TRANSIENT_QUERY_KEYS.some((key) => searchParams.has(key));
}

/** Stable entry URL retaining only ?redirect=. */
export function buildCleanAuthEntryUrl(
  entryPath: AuthEntryPath,
  redirectTo: string,
): string {
  const url = new URL(entryPath, "http://local");
  url.searchParams.set("redirect", safeRedirectTarget(redirectTo, "/"));
  return `${url.pathname}${url.search}`;
}
