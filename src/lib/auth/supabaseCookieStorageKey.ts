/** Matches @supabase/ssr default auth cookie storage key prefix. */
export function supabaseCookieStorageKey(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return "sb-auth-token";
  }
  const ref = new URL(url).hostname.split(".")[0] ?? "auth";
  return `sb-${ref}-auth-token`;
}

export function supabasePkceVerifierCookieName(): string {
  return `${supabaseCookieStorageKey()}-code-verifier`;
}
