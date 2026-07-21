import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DiscoverEditionList,
  mapDiscoverEditionToEventCardModel,
} from "@/src/features/home/components/DiscoverEditionList";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";

function edition(overrides: Partial<PublicEditionSummary> = {}): PublicEditionSummary {
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
    ...overrides,
  };
}

describe("DiscoverEditionList", () => {
  it("renders exactly one full-row event detail link per clickable edition", () => {
    const html = renderToStaticMarkup(
      <DiscoverEditionList
        editions={[
          edition(),
          edition({
            id: "evt-2",
            slug: "bitcoin-asia-2026",
            name: "Bitcoin Asia 2026",
          }),
        ]}
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
    assert.match(html, /Bitcoin Conference/);
    assert.match(html, /April 27 – April 29, 2026/);
    assert.match(html, /Las Vegas, Nevada/);
    assert.equal(html.includes("2026 · 2026-04-27"), false);
    assert.equal(html.includes("Sponsors"), false);
    assert.match(html, /divide-y divide-slate-100 rounded-xl border border-slate-200/);
  });

  it("renders a non-interactive row when no event detail href is available", () => {
    const html = renderToStaticMarkup(
      <DiscoverEditionList editions={[edition({ id: "", slug: "" })]} />,
    );

    assert.equal(html.includes("<a "), false);
    assert.match(html, /Bitcoin Las Vegas 2026/);
  });

  it("maps public edition fields without Explorer-only sponsor or topic data", () => {
    const card = mapDiscoverEditionToEventCardModel(edition());

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
    });
    assert.equal("sponsorCount" in card, false);
    assert.equal("topicPreview" in card, false);
  });
});
