import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DiscoverEditionList } from "@/src/features/home/components/DiscoverEditionList";
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
  });

  it("renders a non-interactive row when no event detail href is available", () => {
    const html = renderToStaticMarkup(
      <DiscoverEditionList editions={[edition({ id: "", slug: "" })]} />,
    );

    assert.equal(html.includes("<a "), false);
    assert.match(html, /Bitcoin Las Vegas 2026/);
  });
});
