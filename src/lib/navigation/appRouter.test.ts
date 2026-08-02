import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { setAppRouterForTests, useAppRouter } from "@/src/lib/navigation/appRouter";

function stubRouter(): AppRouterInstance {
  return {
    push: () => {},
    refresh: () => {},
    replace: () => {},
    prefetch: async () => {},
    back: () => {},
    forward: () => {},
  } as AppRouterInstance;
}

describe("useAppRouter test override", () => {
  after(() => {
    setAppRouterForTests(null);
  });

  it("returns the test stub when setAppRouterForTests is active", () => {
    const stub = stubRouter();
    setAppRouterForTests(stub);
    assert.equal(useAppRouter(), stub);
  });
});
