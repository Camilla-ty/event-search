import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildPublicEditionTabHref,
  parsePublicEditionTab,
} from "@/src/features/events/components/detail/publicEditionTabUrls";
import { PublicEventEditionTabs } from "@/src/features/events/components/detail/PublicEventEditionTabs";
import { shouldInterceptTabAnchorClick } from "@/src/features/events/components/detail/instantTabNavigation";

function renderTabs(
  initialTab: "overview" | "sponsors" | "exhibitors" | "venue" | "organizers",
  options?: { showExhibitorsTab?: boolean; showPartnerAlumniTab?: boolean },
) {
  return renderToStaticMarkup(
    React.createElement(PublicEventEditionTabs, {
      eventSlug: "demo-event",
      initialTab,
      showExhibitorsTab: options?.showExhibitorsTab ?? false,
      showPartnerAlumniTab: options?.showPartnerAlumniTab ?? false,
      overviewPanel: React.createElement("div", { "data-panel": "overview" }, "Overview panel"),
      sponsorsPanel: React.createElement("div", { "data-panel": "sponsors" }, "Sponsors panel"),
      exhibitorsPanel: React.createElement(
        "div",
        { "data-panel": "exhibitors" },
        "Exhibitors panel",
      ),
      venuePanel: React.createElement("div", { "data-panel": "venue" }, "Venue panel"),
      organizersPanel: React.createElement(
        "div",
        { "data-panel": "organizers" },
        "Organizers panel",
      ),
      partnerAlumniPanel: React.createElement(
        "div",
        { "data-panel": "partner-alumni" },
        "Partner Alumni panel",
      ),
    }),
  );
}

describe("parsePublicEditionTab", () => {
  it("falls back to overview when partner-alumni tab is hidden", () => {
    assert.equal(
      parsePublicEditionTab("partner-alumni", {
        showExhibitorsTab: false,
        showPartnerAlumniTab: false,
      }),
      "overview",
    );
  });

  it("selects partner-alumni when tab is shown", () => {
    assert.equal(
      parsePublicEditionTab("partner-alumni", {
        showExhibitorsTab: false,
        showPartnerAlumniTab: true,
      }),
      "partner-alumni",
    );
  });

  it("falls back to overview when exhibitors tab is hidden", () => {
    assert.equal(
      parsePublicEditionTab("exhibitors", {
        showExhibitorsTab: false,
        showPartnerAlumniTab: true,
      }),
      "overview",
    );
  });

  it("selects exhibitors when tab is shown", () => {
    assert.equal(
      parsePublicEditionTab("exhibitors", {
        showExhibitorsTab: true,
        showPartnerAlumniTab: false,
      }),
      "exhibitors",
    );
  });

  it("preserves other tab ids", () => {
    assert.equal(
      parsePublicEditionTab("sponsors", {
        showExhibitorsTab: false,
        showPartnerAlumniTab: false,
      }),
      "sponsors",
    );
    assert.equal(
      parsePublicEditionTab("venue", {
        showExhibitorsTab: true,
        showPartnerAlumniTab: true,
      }),
      "venue",
    );
    assert.equal(
      parsePublicEditionTab("organizers", {
        showExhibitorsTab: true,
        showPartnerAlumniTab: true,
      }),
      "organizers",
    );
    assert.equal(
      parsePublicEditionTab(null, {
        showExhibitorsTab: true,
        showPartnerAlumniTab: true,
      }),
      "overview",
    );
  });
});

describe("PublicEventEditionTabs", () => {
  it("renders the initial sponsors panel and aria-selected state from initialTab", () => {
    const html = renderTabs("sponsors");

    assert.match(html, /data-panel="sponsors"/);
    assert.doesNotMatch(html, /data-panel="overview"/);
    assert.match(html, /href="\/events\/demo-event\?tab=sponsors"/);
    assert.match(html, /aria-selected="true"/);
    assert.match(html, /aria-label="Event sections"/);
    assert.match(html, />Sponsors<\/a>/);
  });

  it("places Exhibitors after Sponsors when the tab is shown", () => {
    const html = renderTabs("exhibitors", { showExhibitorsTab: true });
    const sponsorsIdx = html.indexOf(">Sponsors</a>");
    const exhibitorsIdx = html.indexOf(">Exhibitors</a>");
    const venueIdx = html.indexOf(">Venue</a>");

    assert.ok(sponsorsIdx !== -1);
    assert.ok(exhibitorsIdx !== -1);
    assert.ok(venueIdx !== -1);
    assert.ok(sponsorsIdx < exhibitorsIdx);
    assert.ok(exhibitorsIdx < venueIdx);
    assert.match(html, /data-panel="exhibitors"/);
    assert.match(html, /href="\/events\/demo-event\?tab=exhibitors"/);
  });

  it("omits Exhibitors from the tab bar when hidden", () => {
    const html = renderTabs("overview", { showExhibitorsTab: false });
    assert.doesNotMatch(html, />Exhibitors<\/a>/);
  });

  it("uses a clean overview href without a tab query param", () => {
    const html = renderTabs("overview");

    assert.match(html, /href="\/events\/demo-event"/);
    assert.match(html, /data-panel="overview"/);
    assert.doesNotMatch(html, /href="\/events\/demo-event\?tab=overview"/);
  });

  it("buildPublicEditionTabHref matches overview URL rules", () => {
    assert.equal(buildPublicEditionTabHref("demo-event", "overview"), "/events/demo-event");
    assert.equal(
      buildPublicEditionTabHref("demo-event", "sponsors"),
      "/events/demo-event?tab=sponsors",
    );
    assert.equal(
      buildPublicEditionTabHref("demo-event", "exhibitors"),
      "/events/demo-event?tab=exhibitors",
    );
  });

  it("uses pushState for an intercepted sponsors click", () => {
    const pushCalls: string[] = [];
    const original = globalThis.history;
    Object.defineProperty(globalThis, "history", {
      configurable: true,
      value: {
        pushState: (_state: unknown, _title: string, url: string | URL | null) => {
          pushCalls.push(String(url));
        },
      },
    });

    try {
      const event = {
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        currentTarget: { target: "" },
        preventDefault() {},
      };

      assert.equal(shouldInterceptTabAnchorClick(event), true);
      if (shouldInterceptTabAnchorClick(event)) {
        event.preventDefault();
        globalThis.history.pushState(
          null,
          "",
          buildPublicEditionTabHref("demo-event", "sponsors"),
        );
      }

      assert.deepEqual(pushCalls, ["/events/demo-event?tab=sponsors"]);
    } finally {
      Object.defineProperty(globalThis, "history", {
        configurable: true,
        value: original,
      });
    }
  });

  it("does not intercept modified sponsor tab clicks", () => {
    const event = {
      defaultPrevented: false,
      button: 0,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      currentTarget: { target: "" },
    };

    assert.equal(shouldInterceptTabAnchorClick(event), false);
  });

  it("wraps panels in PublicEditionTabNavigationProvider for shared selectTab", () => {
    const source = readFileSync(
      new URL("./PublicEventEditionTabs.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /PublicEditionTabNavigationProvider/);
    assert.match(source, /selectTab=\{selectTab\}/);
  });

  it("falls back safely when partner alumni is hidden", () => {
    assert.equal(
      parsePublicEditionTab("partner-alumni", {
        showExhibitorsTab: true,
        showPartnerAlumniTab: false,
      }),
      "overview",
    );
  });
});
