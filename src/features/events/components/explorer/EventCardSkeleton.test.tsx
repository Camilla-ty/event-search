import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EventCardSkeleton,
  EventCardSkeletonList,
} from "@/src/features/events/components/explorer/EventCardSkeleton";
import { EventGrid } from "@/src/features/events/components/explorer/EventGrid";
import type { EventExplorerRow } from "@/src/features/events/server/eventExplorerTypes";

function countMatches(html: string, pattern: RegExp): number {
  return [...html.matchAll(pattern)].length;
}

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

describe("EventCardSkeleton", () => {
  it("renders the main EventCard structural regions", () => {
    const html = renderToStaticMarkup(React.createElement(EventCardSkeleton));

    assert.match(html, /data-skeleton="event-card"/);
    assert.match(html, /data-skeleton-region="logo"/);
    assert.match(html, /data-skeleton-region="name"/);
    assert.match(html, /data-skeleton-region="topics"/);
    assert.match(html, /data-skeleton-region="sponsors"/);
    assert.match(html, /data-skeleton-region="date"/);
    assert.match(html, /data-skeleton-region="location"/);
    assert.match(html, /rounded-xl border/);
    assert.match(html, /h-14 w-14/);
    assert.match(html, /rounded-full/);
  });

  it("does not render real event links or event content", () => {
    const html = renderToStaticMarkup(React.createElement(EventCardSkeleton));

    assert.equal(html.includes("<a "), false);
    assert.doesNotMatch(html, /href=/);
    assert.doesNotMatch(html, /Bitcoin|Las Vegas|Sponsors|View /);
  });
});

describe("EventCardSkeletonList", () => {
  it("renders the intended number of skeleton cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(EventCardSkeletonList, { count: 4 }),
    );

    assert.match(html, /aria-busy="true"/);
    assert.match(html, /aria-label="Loading events"/);
    assert.match(html, /animate-pulse/);
    assert.equal(countMatches(html, /data-skeleton="event-card"/g), 4);
  });

  it("defaults to six skeleton cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(EventCardSkeletonList),
    );

    assert.equal(countMatches(html, /data-skeleton="event-card"/g), 6);
  });
});

describe("EventGrid loading state", () => {
  it("renders EventCard skeletons instead of real event cards while loading", () => {
    const html = renderToStaticMarkup(
      React.createElement(EventGrid, {
        rows: [sampleRow()],
        total: 1,
        page: 1,
        pageSize: 20,
        loading: true,
        onPageChange: () => undefined,
        onReset: () => undefined,
      }),
    );

    assert.match(html, /aria-label="Loading events"/);
    assert.equal(countMatches(html, /data-skeleton="event-card"/g), 6);
    assert.match(html, /data-pagination="loading"/);
    assert.doesNotMatch(html, /Bitcoin Las Vegas 2026/);
    assert.doesNotMatch(html, /href="\/events\//);
    assert.doesNotMatch(html, /View Bitcoin/);
    assert.doesNotMatch(html, /aria-label="Loading list"/);
  });

  it("wires EventGrid loading to EventCardSkeletonList with pagination placeholder", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/explorer/EventGrid.tsx",
      ),
      "utf8",
    );

    assert.match(source, /EventCardSkeletonList/);
    assert.match(source, /EventGridPaginationPlaceholder/);
    assert.doesNotMatch(source, /PageLoadingSkeleton/);
  });
});
