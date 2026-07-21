import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DiscoverEditionList,
  mapDiscoverEditionToEventCardModel,
} from "@/src/features/home/components/DiscoverEditionList";
import type { DiscoverEditionSummary } from "@/src/features/home/server/getDiscoverHomeData";

function edition(overrides: Partial<DiscoverEditionSummary> = {}): DiscoverEditionSummary {
  return {
    id: "evt-1",
    slug: "bitcoin-las-vegas-2026",
    name: "Bitcoin Las Vegas 2026",
    year: 2026,
    start_date: "2026-04-27",
    end_date: "2026-04-29",
    locationLabel: "Las Vegas, Nevada",
    event_series: {
      name: "Bitcoin Conference",
      logo_url: null,
    },
    topicPreview: {
      visibleKeywords: [{ key: "kw-1", label: "Bitcoin" }],
      overflowCount: 1,
    },
    ...overrides,
  };
}

describe("DiscoverEditionList", () => {
  it("renders compact Upcoming rows with topics, date, and location only", () => {
    const html = renderToStaticMarkup(
      <DiscoverEditionList
        editions={[
          edition({
            topicPreview: {
              visibleKeywords: [
                { key: "kw-1", label: "Bitcoin" },
                { key: "kw-2", label: "Payments" },
              ],
              overflowCount: 2,
            },
          }),
          edition({
            id: "evt-2",
            slug: "bitcoin-asia-2026",
            name: "Bitcoin Asia 2026",
          }),
        ]}
        variant="compact"
      />,
    );

    assert.equal(html.match(/<li/g)?.length, 2);
    assert.equal(html.match(/<a /g)?.length, 2);
    assert.match(html, /href="\/events\/bitcoin-las-vegas-2026"/);
    assert.match(html, /aria-label="View Bitcoin Las Vegas 2026"/);
    assert.equal(html.includes("View event"), false);
    assert.match(html, /h-14 w-14/);
    assert.match(html, /gap-4/);
    assert.match(html, /space-y-3/);
    assert.match(
      html,
      /line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-slate-900/,
    );
    assert.match(html, /text-sm text-slate-600 md:flex-1/);
    assert.match(html, /md:border-l md:border-slate-200 md:px-4/);
    assert.equal(html.includes("Bitcoin Conference"), false);
    assert.match(html, /Bitcoin/);
    assert.match(html, /Payments/);
    assert.match(html, /\+2/);
    assert.match(html, /Apr 27 – Apr 29, 2026/);
    assert.match(html, /Las Vegas, Nevada/);
    assert.equal(html.includes("2026 · 2026-04-27"), false);
    assert.equal(html.includes("Sponsors"), false);
    assert.match(html, /flex-1 divide-y divide-slate-100/);
    assert.match(html, /divide-y divide-slate-100 rounded-xl border border-slate-200/);
  });

  it("renders Recently Added as Explorer-style full cards", () => {
    const html = renderToStaticMarkup(
      <DiscoverEditionList
        editions={[
          edition({
            sponsorCount: 12,
            topicPreview: {
              visibleKeywords: [
                { key: "kw-1", label: "Bitcoin" },
                { key: "kw-2", label: "Payments" },
                { key: "kw-3", label: "Web3" },
              ],
              overflowCount: 1,
            },
          }),
        ]}
        variant="full"
      />,
    );

    assert.match(html, /12/);
    assert.match(html, /Sponsors/);
    assert.match(html, /Bitcoin/);
    assert.match(html, /Payments/);
    assert.match(html, /Web3/);
    assert.match(html, /\+1/);
    assert.match(html, /Apr 27 – Apr 29, 2026/);
    assert.match(html, /Las Vegas, Nevada/);
    assert.match(html, /space-y-3/);
    assert.match(html, /rounded-xl border border-slate-200 bg-white p-4 shadow-sm/);
    assert.equal(html.includes("flex-1 divide-y"), false);
    assert.equal(html.includes("divide-y divide-slate-100"), false);
    assert.equal(html.includes("Bitcoin Conference"), false);
  });

  it("renders a non-interactive row when no event detail href is available", () => {
    const html = renderToStaticMarkup(
      <DiscoverEditionList
        editions={[edition({ id: "", slug: "" })]}
        variant="compact"
      />,
    );

    assert.equal(html.includes("<a "), false);
    assert.match(html, /Bitcoin Las Vegas 2026/);
  });

  it("maps Discover enrichment into the shared EventCard model", () => {
    const card = mapDiscoverEditionToEventCardModel(edition({ sponsorCount: 7 }));

    assert.deepEqual(card, {
      id: "evt-1",
      name: "Bitcoin Las Vegas 2026",
      href: "/events/bitcoin-las-vegas-2026",
      startDate: "2026-04-27",
      endDate: "2026-04-29",
      locationLabel: "Las Vegas, Nevada",
      series: {
        name: "Bitcoin Conference",
        logo_url: null,
      },
      year: 2026,
      sponsorCount: 7,
      topicPreview: {
        visibleKeywords: [{ key: "kw-1", label: "Bitcoin" }],
        overflowCount: 1,
      },
    });
  });
});
