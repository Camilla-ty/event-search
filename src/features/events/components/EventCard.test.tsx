import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EventCard,
  type EventCardModel,
} from "@/src/features/events/components/EventCard";

function model(overrides: Partial<EventCardModel> = {}): EventCardModel {
  return {
    id: "evt-1",
    name: "Bitcoin Las Vegas 2026",
    href: "/events/bitcoin-las-vegas-2026",
    startDate: "2026-04-27",
    endDate: "2026-04-29",
    locationLabel: "Las Vegas, Nevada",
    series: null,
    sponsorCount: 10,
    topicPreview: null,
    ...overrides,
  };
}

describe("shared EventCard foundation", () => {
  it("disables automatic Next.js prefetch on detail links", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/events/components/EventCard.tsx"),
      "utf8",
    );

    assert.match(
      source,
      /<Link[\s\S]*?prefetch=\{false\}[\s\S]*?>/,
      "Shared EventCard Links must set prefetch={false} to avoid detail RSC prefetch bursts",
    );
  });

  it("renders a clickable link with href and aria-label", () => {
    const html = renderToStaticMarkup(<EventCard event={model()} />);

    assert.match(html, /href="\/events\/bitcoin-las-vegas-2026"/);
    assert.match(html, /aria-label="View Bitcoin Las Vegas 2026"/);
    assert.match(html, /Bitcoin Las Vegas 2026/);
  });

  it("renders a non-link article when href is missing", () => {
    const html = renderToStaticMarkup(<EventCard event={model({ href: null })} />);

    assert.equal(html.includes("<a "), false);
    assert.match(html, /Bitcoin Las Vegas 2026/);
    assert.match(html, /<article/);
  });

  it("renders sponsor count, date range, and location", () => {
    const html = renderToStaticMarkup(
      <EventCard
        event={model({
          sponsorCount: 1,
          startDate: "2026-04-27",
          endDate: "2026-04-29",
          locationLabel: "Las Vegas, Nevada",
        })}
      />,
    );

    assert.match(html, /1/);
    assert.match(html, /Sponsor/);
    assert.match(html, /2026-04-27 - 2026-04-29/);
    assert.match(html, /Las Vegas, Nevada/);
  });

  it("falls back to Location not set and Date TBC when metadata is empty", () => {
    const html = renderToStaticMarkup(
      <EventCard
        event={model({
          startDate: null,
          endDate: null,
          locationLabel: "",
          sponsorCount: 0,
        })}
      />,
    );

    assert.match(html, /Date TBC/);
    assert.match(html, /Location not set/);
    assert.match(html, /0/);
    assert.match(html, /Sponsors/);
  });

  it("renders topic preview badges and overflow count", () => {
    const html = renderToStaticMarkup(
      <EventCard
        event={model({
          topicPreview: {
            visibleKeywords: [
              { key: "kw-1", label: "Bitcoin" },
              { key: "kw-2", label: "Web3" },
            ],
            overflowCount: 2,
          },
        })}
      />,
    );

    assert.match(html, /Bitcoin/);
    assert.match(html, /Web3/);
    assert.match(html, /\+2/);
  });
});
