import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

let refreshScheduled = false;

/** Reset coalescing state — for tests only. */
export function resetCoalescedRouterRefreshForTests(): void {
  refreshScheduled = false;
}

/**
 * Schedule at most one router.refresh per microtask burst across duplicate auth callbacks.
 */
export function scheduleCoalescedRouterRefresh(router: AppRouterInstance): void {
  if (refreshScheduled) {
    return;
  }

  refreshScheduled = true;
  queueMicrotask(() => {
    refreshScheduled = false;
    router.refresh();
  });
}
