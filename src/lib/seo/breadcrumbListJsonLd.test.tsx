import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { JsonLd, serializeJsonLd } from "@/src/components/seo/JsonLd";
import { buildBreadcrumbListJsonLd } from "@/src/lib/seo/breadcrumbListJsonLd";

const SITE = new URL("https://app.eventpx.com/");

describe("buildBreadcrumbListJsonLd", () => {
  it("builds a correct two-item Event breadcrumb graph", () => {
    const graph = buildBreadcrumbListJsonLd({
      items: [
        { label: "Events", href: "/events" },
        { label: "TOKEN2049 Singapore 2025" },
      ],
      currentPagePath: "/events/token2049-singapore-2025",
      siteUrl: SITE,
    });

    assert.ok(graph);
    assert.equal(graph["@context"], "https://schema.org");
    assert.equal(graph["@type"], "BreadcrumbList");
    assert.equal(graph.itemListElement.length, 2);
    assert.deepEqual(graph.itemListElement[0], {
      "@type": "ListItem",
      position: 1,
      name: "Events",
      item: "https://app.eventpx.com/events",
    });
    assert.deepEqual(graph.itemListElement[1], {
      "@type": "ListItem",
      position: 2,
      name: "TOKEN2049 Singapore 2025",
      item: "https://app.eventpx.com/events/token2049-singapore-2025",
    });
  });

  it("uses positions starting at 1", () => {
    const graph = buildBreadcrumbListJsonLd({
      items: [
        { label: "Events", href: "/events" },
        { label: "Edition" },
      ],
      currentPagePath: "/events/edition",
      siteUrl: SITE,
    });
    assert.ok(graph);
    assert.equal(graph.itemListElement[0]?.position, 1);
    assert.equal(graph.itemListElement[1]?.position, 2);
  });

  it("resolves absolute URLs via the site origin", () => {
    const graph = buildBreadcrumbListJsonLd({
      items: [
        { label: "Events", href: "/events" },
        { label: "Edition" },
      ],
      currentPagePath: "/events/edition",
      siteUrl: SITE,
    });
    assert.ok(graph);
    for (const entry of graph.itemListElement) {
      assert.match(entry.item, /^https:\/\/app\.eventpx\.com\//);
    }
  });

  it("uses currentPagePath for the final item even without href", () => {
    const graph = buildBreadcrumbListJsonLd({
      items: [
        { label: "Events", href: "/events" },
        { label: "Edition Name" },
      ],
      currentPagePath: "/events/canonical-slug",
      siteUrl: SITE,
    });
    assert.ok(graph);
    assert.equal(
      graph.itemListElement[1]?.item,
      "https://app.eventpx.com/events/canonical-slug",
    );
  });

  it("removes query strings and hashes from breadcrumb URLs", () => {
    const graph = buildBreadcrumbListJsonLd({
      items: [
        { label: "Events", href: "/events?sort=name#top" },
        { label: "Edition" },
      ],
      currentPagePath: "/events/edition?tab=sponsors#roster",
      siteUrl: SITE,
    });
    assert.ok(graph);
    assert.equal(graph.itemListElement[0]?.item, "https://app.eventpx.com/events");
    assert.equal(
      graph.itemListElement[1]?.item,
      "https://app.eventpx.com/events/edition",
    );
  });

  it("returns null when fewer than two items exist", () => {
    assert.equal(
      buildBreadcrumbListJsonLd({
        items: [{ label: "Events", href: "/events" }],
        currentPagePath: "/events/edition",
        siteUrl: SITE,
      }),
      null,
    );
    assert.equal(
      buildBreadcrumbListJsonLd({
        items: [],
        currentPagePath: "/events/edition",
        siteUrl: SITE,
      }),
      null,
    );
  });

  it("returns null when any label is empty after trimming", () => {
    assert.equal(
      buildBreadcrumbListJsonLd({
        items: [
          { label: "Events", href: "/events" },
          { label: "   " },
        ],
        currentPagePath: "/events/edition",
        siteUrl: SITE,
      }),
      null,
    );
  });

  it("returns null when an intermediate item has no usable href", () => {
    assert.equal(
      buildBreadcrumbListJsonLd({
        items: [{ label: "Events" }, { label: "Edition" }],
        currentPagePath: "/events/edition",
        siteUrl: SITE,
      }),
      null,
    );
    assert.equal(
      buildBreadcrumbListJsonLd({
        items: [
          { label: "Events", href: "   " },
          { label: "Edition" },
        ],
        currentPagePath: "/events/edition",
        siteUrl: SITE,
      }),
      null,
    );
  });

  it("returns null when the current page URL cannot be established", () => {
    assert.equal(
      buildBreadcrumbListJsonLd({
        items: [
          { label: "Events", href: "/events" },
          { label: "Edition" },
        ],
        currentPagePath: "   ",
        siteUrl: SITE,
      }),
      null,
    );
  });

  it("does not invent a Home item", () => {
    const graph = buildBreadcrumbListJsonLd({
      items: [
        { label: "Events", href: "/events" },
        { label: "Edition" },
      ],
      currentPagePath: "/events/edition",
      siteUrl: SITE,
    });
    assert.ok(graph);
    const names = graph.itemListElement.map((entry) => entry.name);
    assert.deepEqual(names, ["Events", "Edition"]);
    assert.equal(names.includes("Home"), false);
  });

  it("serializes safely through the existing JsonLd serializer", () => {
    const graph = buildBreadcrumbListJsonLd({
      items: [
        { label: "Events", href: "/events" },
        { label: 'Break </script><script>alert(1)</script>' },
      ],
      currentPagePath: "/events/edition",
      siteUrl: SITE,
    });
    assert.ok(graph);

    const serialized = serializeJsonLd(graph);
    assert.equal(serialized.includes("<"), false);
    assert.equal(serialized.includes("</script>"), false);
    assert.deepEqual(JSON.parse(serialized), graph);

    const html = renderToStaticMarkup(<JsonLd data={graph} />);
    assert.match(html, /type="application\/ld\+json"/);
    assert.doesNotMatch(html, /<\/script><script>/);
    const start = html.indexOf(">") + 1;
    const end = html.lastIndexOf("</script>");
    assert.deepEqual(JSON.parse(html.slice(start, end)), graph);
  });
});
