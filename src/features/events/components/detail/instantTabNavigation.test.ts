import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  pushTabHistoryUrl,
  readTabSearchParamFromWindow,
  shouldInterceptTabAnchorClick,
} from "@/src/features/events/components/detail/instantTabNavigation";

function anchorClickEvent(
  overrides: Partial<{
    defaultPrevented: boolean;
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    target: string;
  }> = {},
) {
  return {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    currentTarget: { target: overrides.target ?? "" },
    ...overrides,
  };
}

describe("shouldInterceptTabAnchorClick", () => {
  it("intercepts a normal primary click", () => {
    assert.equal(shouldInterceptTabAnchorClick(anchorClickEvent()), true);
  });

  it("does not intercept middle-click", () => {
    assert.equal(shouldInterceptTabAnchorClick(anchorClickEvent({ button: 1 })), false);
  });

  it("does not intercept modified primary clicks", () => {
    assert.equal(shouldInterceptTabAnchorClick(anchorClickEvent({ metaKey: true })), false);
    assert.equal(shouldInterceptTabAnchorClick(anchorClickEvent({ ctrlKey: true })), false);
    assert.equal(shouldInterceptTabAnchorClick(anchorClickEvent({ shiftKey: true })), false);
    assert.equal(shouldInterceptTabAnchorClick(anchorClickEvent({ altKey: true })), false);
  });

  it("does not intercept when default is already prevented", () => {
    assert.equal(
      shouldInterceptTabAnchorClick(anchorClickEvent({ defaultPrevented: true })),
      false,
    );
  });

  it("does not intercept links targeting another browsing context", () => {
    assert.equal(
      shouldInterceptTabAnchorClick(anchorClickEvent({ target: "_blank" })),
      false,
    );
  });
});

describe("tab history helpers", () => {
  it("pushTabHistoryUrl calls history.pushState", () => {
    const calls: string[] = [];
    const original = globalThis.history;

    Object.defineProperty(globalThis, "history", {
      configurable: true,
      value: {
        pushState: (_state: unknown, _title: string, url: string | URL | null) => {
          calls.push(String(url));
        },
      },
    });

    try {
      pushTabHistoryUrl("/events/demo?tab=sponsors");
      assert.deepEqual(calls, ["/events/demo?tab=sponsors"]);
    } finally {
      Object.defineProperty(globalThis, "history", {
        configurable: true,
        value: original,
      });
    }
  });

  it("readTabSearchParamFromWindow reads the tab query param", () => {
    const original = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { search: "?tab=venue" },
      },
    });

    try {
      assert.equal(readTabSearchParamFromWindow(), "venue");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: original,
      });
    }
  });
});
