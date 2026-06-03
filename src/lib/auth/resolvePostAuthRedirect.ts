import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";

/**
 * Resolves the post-authentication destination from ?redirect= (login or signup success).
 */
export function resolvePostAuthRedirect(
  redirectTo: string | null | undefined,
  fallback = "/",
): string {
  return safeRedirectTarget(redirectTo, fallback);
}

/**
 * Applies post-auth navigation after OTP verify or modal success (client-only).
 */
export function applyPostAuthRedirect(
  router: AppRouterInstance,
  redirectTo: string | null | undefined,
  fallback = "/",
): void {
  const target = resolvePostAuthRedirect(redirectTo, fallback);
  router.replace(target);
  router.refresh();
}
