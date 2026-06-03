import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server OAuth: @supabase/ssr persists session cookies in an async
 * onAuthStateChange handler. Start this before exchangeCodeForSession().
 */
export function waitForAuthCookieFlush(
  supabase: SupabaseClient,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error("Timed out waiting for auth cookies to be set."));
    }, timeoutMs);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        clearTimeout(timeout);
        setTimeout(() => {
          subscription.unsubscribe();
          resolve();
        }, 0);
      }
    });
  });
}
