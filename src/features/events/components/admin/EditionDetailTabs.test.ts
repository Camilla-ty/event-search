import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EditionDetailTabs,
} from "@/src/features/events/components/admin/EditionDetailTabs";
import { parseAdminEditionTab } from "@/src/features/events/components/admin/adminEditionTabUrls";
import { shouldInterceptTabAnchorClick } from "@/src/features/events/components/detail/instantTabNavigation";

function renderTabs(initialTab: "profile" | "sponsors" | "imports") {
  return renderToStaticMarkup(
    React.createElement(EditionDetailTabs, {
      editionId: "edition-1",
      initialTab,
      profileWarnings: [],
      profilePanel: React.createElement("div", { "data-panel": "profile" }, "Profile panel"),
      sponsorsPanel: React.createElement("div", { "data-panel": "sponsors" }, "Sponsors panel"),
      importsPanel: React.createElement("div", { "data-panel": "imports" }, "Imports panel"),
    }),
  );
}

describe("parseAdminEditionTab", () => {
  it("defaults to profile", () => {
    assert.equal(parseAdminEditionTab(null), "profile");
  });

  it("maps legacy organizers to profile", () => {
    assert.equal(parseAdminEditionTab("organizers"), "profile");
  });

  it("preserves sponsors and imports", () => {
    assert.equal(parseAdminEditionTab("sponsors"), "sponsors");
    assert.equal(parseAdminEditionTab("imports"), "imports");
  });
});

describe("EditionDetailTabs", () => {
  it("renders the initial sponsors panel immediately from initialTab", () => {
    const html = renderTabs("sponsors");

    assert.match(html, /data-panel="sponsors"/);
    assert.doesNotMatch(html, /data-panel="profile"/);
    assert.match(html, /href="\/admin\/events\/editions\/edition-1\?tab=sponsors"/);
  });

  it("defaults to profile panel", () => {
    const html = renderTabs("profile");
    assert.match(html, /data-panel="profile"/);
  });

  it("switches imports panel markup from initialTab", () => {
    const html = renderTabs("imports");
    assert.match(html, /data-panel="imports"/);
  });

  it("does not intercept modified clicks", () => {
    assert.equal(
      shouldInterceptTabAnchorClick({
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        currentTarget: { target: "" },
      }),
      false,
    );
  });

  it("popstate parsing restores sponsors from the URL", () => {
    const original = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { search: "?tab=sponsors" },
      },
    });

    try {
      assert.equal(parseAdminEditionTab(new URLSearchParams("?tab=sponsors").get("tab")), "sponsors");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: original,
      });
    }
  });
});
