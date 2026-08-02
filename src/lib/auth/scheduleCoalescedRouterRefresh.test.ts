import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import {
  resetCoalescedRouterRefreshForTests,
  scheduleCoalescedRouterRefresh,
} from "@/src/lib/auth/scheduleCoalescedRouterRefresh";

function mockRouter(refresh: () => void): AppRouterInstance {
  return {
    back: () => undefined,
    forward: () => undefined,
    refresh,
    push: async () => true,
    replace: async () => true,
    prefetch: async () => undefined,
  };
}

describe("scheduleCoalescedRouterRefresh", () => {
  it("calls router.refresh at most once per microtask burst", async () => {
    resetCoalescedRouterRefreshForTests();

    let refreshCount = 0;
    const router = mockRouter(() => {
      refreshCount += 1;
    });

    scheduleCoalescedRouterRefresh(router);
    scheduleCoalescedRouterRefresh(router);
    scheduleCoalescedRouterRefresh(router);

    await new Promise<void>((resolve) => queueMicrotask(resolve));

    assert.equal(refreshCount, 1);
  });

  it("allows a later burst after the microtask runs", async () => {
    resetCoalescedRouterRefreshForTests();

    let refreshCount = 0;
    const router = mockRouter(() => {
      refreshCount += 1;
    });

    scheduleCoalescedRouterRefresh(router);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    scheduleCoalescedRouterRefresh(router);
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    assert.equal(refreshCount, 2);
  });
});
