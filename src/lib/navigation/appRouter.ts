import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

let testOverride: AppRouterInstance | null = null;

/** Test-only: supply a router without Next.js App Router context. */
export function setAppRouterForTests(router: AppRouterInstance | null): void {
  testOverride = router;
}

/**
 * App Router access with an optional test override.
 * Production always takes the `useRouter()` path (override stays null).
 */
export function useAppRouter(): AppRouterInstance {
  if (testOverride) {
    return testOverride;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- override is process-lifetime (tests only)
  return useRouter();
}
