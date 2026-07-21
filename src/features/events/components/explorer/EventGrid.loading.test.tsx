import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EventGrid } from "@/src/features/events/components/explorer/EventGrid";
import type { EventExplorerRow } from "@/src/features/events/server/eventExplorerTypes";

function sampleRow(): EventExplorerRow {
  return {
    id: "evt-1",
    slug: "bitcoin-las-vegas-2026",
    name: "Bitcoin Las Vegas 2026",
    href: "/events/bitcoin-las-vegas-2026",
    start_date: "2026-04-27",
    end_date: "2026-04-29",
    sponsor_count: 10,
    location_label: "Las Vegas, Nevada",
    series: null,
    keyword_preview: null,
  };
}

describe("EventGrid loading", () => {
  it("shows the shared PageLoadingSkeleton list while loading", () => {
    const html = renderToStaticMarkup(
      React.createElement(EventGrid, {
        rows: [sampleRow()],
        total: 83,
        page: 1,
        pageSize: 20,
        loading: true,
        onPageChange: () => undefined,
        onReset: () => undefined,
      }),
    );

    assert.match(html, /aria-label="Loading list"/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /animate-pulse/);
    assert.doesNotMatch(html, /Bitcoin Las Vegas 2026/);
    assert.doesNotMatch(html, /data-pagination="loading"/);
    assert.doesNotMatch(html, /Showing 1 to 20 of 83/);
    assert.doesNotMatch(html, /Updating results/);
  });

  it("shows event cards after loading completes", () => {
    const html = renderToStaticMarkup(
      React.createElement(EventGrid, {
        rows: [sampleRow()],
        total: 3,
        page: 1,
        pageSize: 20,
        loading: false,
        onPageChange: () => undefined,
        onReset: () => undefined,
      }),
    );

    assert.match(html, /Bitcoin Las Vegas 2026/);
    assert.match(html, /Showing 1 to 3 of 3 events/);
    assert.doesNotMatch(html, /aria-label="Loading list"/);
  });

  it("wires EventGrid to PageLoadingSkeleton and does not keep EventCardSkeleton", () => {
    const gridSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/explorer/EventGrid.tsx",
      ),
      "utf8",
    );
    const pageSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/explorer/EventExplorerPage.tsx",
      ),
      "utf8",
    );

    assert.match(gridSource, /PageLoadingSkeleton/);
    assert.match(gridSource, /variant="list"/);
    assert.doesNotMatch(gridSource, /EventCardSkeleton/);
    assert.doesNotMatch(pageSource, /isLoading=\{isLoading\}/);
    assert.doesNotMatch(pageSource, /Updating results/);
  });
});
