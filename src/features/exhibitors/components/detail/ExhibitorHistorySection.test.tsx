import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExhibitorHistorySection } from "@/src/features/exhibitors/components/detail/ExhibitorHistorySection";
import type {
  ExhibitorHistoryEvent,
  ExhibitorHistorySeriesGroup,
} from "@/src/features/exhibitors/server/exhibitorHistoryModel";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

function edition(
  partial: Partial<ExhibitorHistoryEvent> & {
    id: string;
    name: string;
    seriesId: string;
    seriesName: string;
    cities?: unknown;
  },
): ExhibitorHistoryEvent {
  const { seriesId, seriesName, cities, ...rest } = partial;
  return {
    slug: null,
    year: 2025,
    start_date: "2025-06-01",
    end_date: "2025-06-02",
    event_series: { id: seriesId, name: seriesName },
    cities: cities ?? null,
    ...rest,
  } as ExhibitorHistoryEvent;
}

function render(groups: ExhibitorHistorySeriesGroup[]): string {
  return renderToStaticMarkup(<ExhibitorHistorySection groups={groups} />);
}

describe("ExhibitorHistorySection", () => {
  it("renders nothing when history is empty", () => {
    assert.equal(render([]), "");
  });

  it("renders Exhibitor history with event fields, city, tier, and event link", () => {
    const ed = edition({
      id: "11111111-1111-1111-1111-111111111111",
      slug: "alpha-2025",
      name: "Alpha 2025",
      seriesId: "s1",
      seriesName: "Alpha Brand",
      cities: {
        name: "London",
        countries: { name: "United Kingdom" },
      },
    });
    const href = buildEventDetailPath({ slug: ed.slug, id: String(ed.id) });
    assert.equal(href, "/events/alpha-2025");

    const html = render([
      {
        series: { id: "s1", name: "Alpha Brand" },
        editions: [{ edition: ed, tierRank: 1, tierLabel: "Gold" }],
      },
    ]);

    assert.match(html, /Exhibitor history/);
    assert.match(html, /Alpha Brand/);
    assert.match(html, /Alpha 2025/);
    assert.match(html, /Gold/);
    assert.match(html, /London/);
    assert.match(html, /United Kingdom/);
    assert.match(html, new RegExp(`href="${href}"`));
    assert.match(html, /View event/);
  });

  it("omits city when absent and falls back to Tier {rank}", () => {
    const html = render([
      {
        series: { id: "s1", name: "Alpha Brand" },
        editions: [
          {
            edition: edition({
              id: "e1",
              name: "Alpha 2025",
              seriesId: "s1",
              seriesName: "Alpha Brand",
              cities: null,
            }),
            tierRank: 3,
            tierLabel: null,
          },
        ],
      },
    ]);

    assert.match(html, /Tier 3/);
    assert.doesNotMatch(html, /London/);
  });

  it("falls back Event Detail href to id when slug is missing", () => {
    const id = "22222222-2222-2222-2222-222222222222";
    const href = buildEventDetailPath({ slug: null, id });
    assert.equal(href, `/events/${id}`);

    const html = render([
      {
        series: { id: "s1", name: "Alpha Brand" },
        editions: [
          {
            edition: edition({
              id,
              slug: null,
              name: "Alpha 2025",
              seriesId: "s1",
              seriesName: "Alpha Brand",
            }),
            tierRank: null,
            tierLabel: null,
          },
        ],
      },
    ]);

    assert.match(html, new RegExp(`href="${href}"`));
  });
});
