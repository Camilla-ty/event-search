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
    assert.match(html, /Apr 27 – Apr 29, 2026/);
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
    assert.match(html, /md:max-w-\[45%\]/);
    assert.match(html, /lg:max-w-\[50%\]/);
    assert.equal(html.includes("md:max-w-[55%]"), false);
    assert.equal(html.includes("md:w-1/2"), false);
    assert.equal(html.includes("md:text-right"), false);
  });

  it("renders compact cards with topics, date, and location but no series text", () => {
    const html = renderToStaticMarkup(
      <EventCard
        event={model({
          year: 2026,
          series: {
            name: "Bitcoin Conference",
            logo_url: null,
          },
          topicPreview: {
            visibleKeywords: [{ key: "kw-1", label: "Payments" }],
            overflowCount: 2,
          },
        })}
        variant="compact"
      />,
    );

    assert.match(html, /href="\/events\/bitcoin-las-vegas-2026"/);
    assert.match(html, /aria-label="View Bitcoin Las Vegas 2026"/);
    assert.match(html, /h-14 w-14/);
    assert.match(html, /gap-4/);
    assert.match(html, /space-y-3/);
    assert.match(
      html,
      /line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-slate-900/,
    );
    assert.match(html, /flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-3/);
    assert.match(html, /flex flex-col gap-2 md:flex-row md:items-center/);
    assert.match(html, /text-sm text-slate-600 md:flex-1/);
    assert.match(html, /md:border-l md:border-slate-200 md:px-4/);
    assert.equal(html.includes("Bitcoin Conference"), false);
    assert.match(html, /Payments/);
    assert.match(html, /\+2/);
    assert.match(html, /md:w-1\/2 md:flex-none/);
    assert.match(html, /md:w-\[45%\] md:max-w-\[45%\] md:shrink-0/);
    assert.equal(html.includes("md:max-w-[55%]"), false);
    assert.match(html, /Apr 27 – Apr 29, 2026/);
    assert.match(html, /Las Vegas, Nevada/);
    assert.match(html, /line-clamp-2 md:text-right/);
    assert.equal(html.includes("2026 · 2026-04-27"), false);
    assert.match(html, /hover:bg-brand-primary-muted\/30/);
    assert.match(html, /focus-visible:ring-2 focus-visible:ring-brand-primary\/30/);
  });

  it("omits sponsor count but keeps topic badges in compact cards", () => {
    const html = renderToStaticMarkup(
      <EventCard
        event={model({
          sponsorCount: 42,
          topicPreview: {
            visibleKeywords: [{ key: "kw-1", label: "Payments" }],
            overflowCount: 3,
          },
        })}
        variant="compact"
      />,
    );

    assert.equal(html.includes("42"), false);
    assert.equal(html.includes("Sponsors"), false);
    assert.match(html, /Payments/);
    assert.match(html, /\+3/);
  });

  it("uses Explorer missing-data fallbacks in compact cards", () => {
    const html = renderToStaticMarkup(
      <EventCard
        event={model({
          href: "/events/untitled",
          series: null,
          year: null,
          startDate: null,
          endDate: null,
          locationLabel: "",
        })}
        variant="compact"
      />,
    );

    assert.match(html, /Date TBC/);
    assert.match(html, /Location not set/);
  });

  it("renders compact cards as non-interactive rows when href is missing", () => {
    const html = renderToStaticMarkup(
      <EventCard event={model({ href: null })} variant="compact" />,
    );

    assert.equal(html.includes("<a "), false);
    assert.equal(html.includes("<article"), false);
    assert.match(html, /class="block w-full p-4"/);
    assert.equal(html.includes("rounded-xl border border-slate-200"), false);
    assert.equal(html.includes("shadow-sm"), false);
  });
});
