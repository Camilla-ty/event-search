import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  pushHistoryUrl,
  readPathnameFromWindow,
  readSearchParamFromWindow,
  readSearchParamsFromWindow,
  replaceHistoryUrl,
  shouldInterceptInPageAnchorClick,
} from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

describe("shouldInterceptInPageAnchorClick", () => {
  it("allows a plain left click", () => {
    const event = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      currentTarget: { target: "" },
    };

    assert.equal(shouldInterceptInPageAnchorClick(event), true);
  });

  it("rejects modified clicks", () => {
    const event = {
      defaultPrevented: false,
      button: 0,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      currentTarget: { target: "" },
    };

    assert.equal(shouldInterceptInPageAnchorClick(event), false);
  });
});

describe("history URL writers", () => {
  it("records pushState and replaceState calls", () => {
    const calls: Array<{ mode: "push" | "replace"; href: string }> = [];
    const original = globalThis.history;

    Object.defineProperty(globalThis, "history", {
      configurable: true,
      value: {
        pushState: (_state: unknown, _title: string, url: string | URL | null) => {
          calls.push({ mode: "push", href: String(url) });
        },
        replaceState: (_state: unknown, _title: string, url: string | URL | null) => {
          calls.push({ mode: "replace", href: String(url) });
        },
      },
    });

    try {
      pushHistoryUrl("/events?topic=bitcoin");
      replaceHistoryUrl("/events");

      assert.deepEqual(calls, [
        { mode: "push", href: "/events?topic=bitcoin" },
        { mode: "replace", href: "/events" },
      ]);
    } finally {
      Object.defineProperty(globalThis, "history", {
        configurable: true,
        value: original,
      });
    }
  });
});

describe("readPathnameFromWindow", () => {
  it("returns empty string when window is unavailable", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });

    try {
      assert.equal(readPathnameFromWindow(), "");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});

describe("readSearchParamsFromWindow", () => {
  it("returns empty params when window is unavailable", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });

    try {
      assert.equal(readSearchParamsFromWindow().toString(), "");
      assert.equal(readSearchParamFromWindow("tab"), null);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});

describe("buildPathWithSearchParams", () => {
  it("omits the query string when params are empty", () => {
    assert.equal(buildPathWithSearchParams("/events", new URLSearchParams()), "/events");
  });

  it("builds a query string for non-empty params", () => {
    const params = new URLSearchParams();
    params.set("q", "token");
    params.append("topic", "bitcoin");

    assert.equal(
      buildPathWithSearchParams("/events", params),
      "/events?q=token&topic=bitcoin",
    );
  });
});
