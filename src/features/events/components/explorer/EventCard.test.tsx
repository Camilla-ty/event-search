import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EventCard } from "@/src/features/events/components/explorer/EventCard";
import type { EventExplorerRow } from "@/src/features/events/server/eventExplorerTypes";

function row(overrides: Partial<EventExplorerRow> = {}): EventExplorerRow {
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
    ...overrides,
  };
}

describe("EventCard", () => {
  it("disables automatic Next.js prefetch on explorer result-card detail links", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/explorer/EventCard.tsx",
      ),
      "utf8",
    );

    assert.match(
      source,
      /<Link[\s\S]*?prefetch=\{false\}[\s\S]*?>/,
      "Explorer EventCard Links must set prefetch={false} to avoid detail RSC prefetch bursts",
    );
  });

  it("still renders a clickable link to the event detail href", () => {
    const html = renderToStaticMarkup(<EventCard event={row()} />);

    assert.match(html, /href="\/events\/bitcoin-las-vegas-2026"/);
    assert.match(html, /aria-label="View Bitcoin Las Vegas 2026"/);
    assert.match(html, /Bitcoin Las Vegas 2026/);
  });

  it("renders a non-link article when href is missing", () => {
    const html = renderToStaticMarkup(
      <EventCard event={row({ href: "" as unknown as string })} />,
    );

    assert.equal(html.includes("<a "), false);
    assert.match(html, /Bitcoin Las Vegas 2026/);
  });
});
