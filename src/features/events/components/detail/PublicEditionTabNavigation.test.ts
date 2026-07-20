import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PublicEditionInPageTabLink,
  type PublicEditionSelectTab,
} from "@/src/features/events/components/detail/PublicEditionTabNavigation";
import { shouldInterceptInPageAnchorClick } from "@/src/lib/navigation/historyUrl";
import { buildPublicEditionTabHref } from "@/src/features/events/components/detail/publicEditionTabUrls";

const detailDir = dirname(fileURLToPath(import.meta.url));

function readSource(filename: string): string {
  return readFileSync(join(detailDir, filename), "utf8");
}

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

describe("PublicEditionInPageTabLink wiring", () => {
  it("EventOverviewSummarySection uses PublicEditionInPageTabLink for sponsors and venue tabs", () => {
    const source = readSource("EventOverviewSummarySection.tsx");

    assert.match(source, /PublicEditionInPageTabLink/);
    assert.match(source, /tab="sponsors"/);
    assert.match(source, /tab="venue"/);
    assert.doesNotMatch(source, /href=\{sponsorsTabHref\}/);
    assert.doesNotMatch(source, /href=\{venueTabHref\}/);
  });

  it("PublicEventEditionTabs provides selectTab via PublicEditionTabNavigationProvider", () => {
    const source = readSource("PublicEventEditionTabs.tsx");

    assert.match(source, /PublicEditionTabNavigationProvider/);
    assert.match(source, /selectTab=\{selectTab\}/);
    assert.match(source, /const \{ activeTab, handleTabClick, selectTab \}/);
  });

  it("renders real crawlable hrefs for sponsors and venue tabs", () => {
    const sponsorsHtml = renderToStaticMarkup(
      createElement(
        PublicEditionInPageTabLink,
        { eventSlug: "demo-event", tab: "sponsors" },
        "Sponsors preview",
      ),
    );
    const venueHtml = renderToStaticMarkup(
      createElement(
        PublicEditionInPageTabLink,
        { eventSlug: "demo-event", tab: "venue" },
        "Venue Name",
      ),
    );

    assert.match(sponsorsHtml, /href="\/events\/demo-event\?tab=sponsors"/);
    assert.match(venueHtml, /href="\/events\/demo-event\?tab=venue"/);
  });
});

describe("PublicEditionInPageTabLink click path", () => {
  it("plain click selects tab via shared selectTab and pushState href", () => {
    const selected: Array<{ tab: string; href: string }> = [];
    const selectTab: PublicEditionSelectTab = (tab, href) => {
      selected.push({ tab, href });
    };

    const href = buildPublicEditionTabHref("demo-event", "sponsors");
    let prevented = false;
    const event = {
      ...anchorClickEvent(),
      preventDefault() {
        prevented = true;
      },
    };

    assert.equal(shouldInterceptInPageAnchorClick(event), true);
    event.preventDefault();
    selectTab("sponsors", href);

    assert.equal(prevented, true);
    assert.deepEqual(selected, [{ tab: "sponsors", href }]);
  });

  it("venue plain click uses the same selectTab path", () => {
    const selected: Array<{ tab: string; href: string }> = [];
    const selectTab: PublicEditionSelectTab = (tab, href) => {
      selected.push({ tab, href });
    };

    const href = buildPublicEditionTabHref("demo-event", "venue");
    const event = anchorClickEvent();

    assert.equal(shouldInterceptInPageAnchorClick(event), true);
    selectTab("venue", href);

    assert.deepEqual(selected, [{ tab: "venue", href }]);
  });

  it("does not intercept Cmd/Ctrl-click", () => {
    assert.equal(shouldInterceptInPageAnchorClick(anchorClickEvent({ metaKey: true })), false);
    assert.equal(shouldInterceptInPageAnchorClick(anchorClickEvent({ ctrlKey: true })), false);
  });

  it("does not intercept middle-click", () => {
    assert.equal(shouldInterceptInPageAnchorClick(anchorClickEvent({ button: 1 })), false);
  });

  it("renders without Next.js Link and keeps crawlable href when outside provider", () => {
    const html = renderToStaticMarkup(
      createElement(
        PublicEditionInPageTabLink,
        {
          eventSlug: "demo-event",
          tab: "sponsors",
          "aria-label": "View all 10 sponsors",
        },
        "Sponsors preview",
      ),
    );

    assert.match(html, /href="\/events\/demo-event\?tab=sponsors"/);
    assert.match(html, /aria-label="View all 10 sponsors"/);
    assert.doesNotMatch(html, /next/);
  });
});
