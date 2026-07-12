import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resetCoalescedRouterRefreshForTests,
  scheduleCoalescedRouterRefresh,
} from "@/src/lib/auth/scheduleCoalescedRouterRefresh";

describe("scheduleCoalescedRouterRefresh", () => {
  it("calls router.refresh at most once per microtask burst", async () => {
    resetCoalescedRouterRefreshForTests();

    let refreshCount = 0;
    const router = {
      refresh: () => {
        refreshCount += 1;
      },
    };

    scheduleCoalescedRouterRefresh(router);
    scheduleCoalescedRouterRefresh(router);
    scheduleCoalescedRouterRefresh(router);

    await new Promise<void>((resolve) => queueMicrotask(resolve));

    assert.equal(refreshCount, 1);
  });

  it("allows a later burst after the microtask runs", async () => {
    resetCoalescedRouterRefreshForTests();

    let refreshCount = 0;
    const router = {
      refresh: () => {
        refreshCount += 1;
      },
    };

    scheduleCoalescedRouterRefresh(router);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    scheduleCoalescedRouterRefresh(router);
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    assert.equal(refreshCount, 2);
  });
});
