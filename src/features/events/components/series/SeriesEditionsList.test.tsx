import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SeriesEditionsList } from "@/src/features/events/components/series/SeriesEditionsList";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";

function edition(
  overrides: Partial<PublicEditionSummary> = {},
): PublicEditionSummary {
  return {
    id: "ed-1",
    slug: "token2049-singapore-2025",
    name: "TOKEN2049 Singapore 2025",
    year: 2025,
    start_date: "2025-10-01",
    end_date: "2025-10-02",
    locationLabel: "Singapore",
    event_series: {
      name: "TOKEN2049",
      logo_url: null,
    },
    ...overrides,
  };
}

describe("SeriesEditionsList", () => {
  it("renders a full-row link for a valid edition with no View event button", () => {
    const html = renderToStaticMarkup(
      <SeriesEditionsList editions={[edition()]} />,
    );

    assert.match(html, />All events</);
    assert.match(html, /TOKEN2049 Singapore 2025/);
    assert.match(html, /2025/);
    assert.match(html, /Singapore/);
    assert.match(html, /href="\/events\/token2049-singapore-2025"/);
    assert.match(html, /aria-label="View TOKEN2049 Singapore 2025"/);
    assert.doesNotMatch(html, /View event/);
    assert.equal((html.match(/<a /g) ?? []).length, 1);
  });

  it("falls back to the edition id when slug is missing", () => {
    const html = renderToStaticMarkup(
      <SeriesEditionsList
        editions={[
          edition({
            id: "edition-uuid-1",
            slug: "",
            name: "Untitled Edition",
          }),
        ]}
      />,
    );

    assert.match(html, /href="\/events\/edition-uuid-1"/);
    assert.match(html, /aria-label="View Untitled Edition"/);
    assert.doesNotMatch(html, /View event/);
  });

  it("keeps the row non-interactive when no valid route exists", () => {
    const html = renderToStaticMarkup(
      <SeriesEditionsList
        editions={[
          edition({
            id: "",
            slug: "",
            name: "Unroutable Edition",
          }),
        ]}
      />,
    );

    assert.match(html, /Unroutable Edition/);
    assert.doesNotMatch(html, /<a /);
    assert.doesNotMatch(html, /href=/);
    assert.doesNotMatch(html, /aria-label=/);
    assert.doesNotMatch(html, /View event/);
  });

  it("applies accessible whole-row hover and focus-visible styles", () => {
    const html = renderToStaticMarkup(
      <SeriesEditionsList editions={[edition()]} />,
    );

    assert.match(html, /hover:bg-brand-primary-muted\/30/);
    assert.match(html, /focus-visible:outline-none/);
    assert.match(html, /focus-visible:ring-2/);
    assert.match(html, /focus-visible:ring-brand-primary\/30/);
    assert.match(html, /focus-visible:ring-offset-2/);
  });

  it("renders the empty state when there are no editions", () => {
    const html = renderToStaticMarkup(<SeriesEditionsList editions={[]} />);

    assert.match(html, /No public events are listed for this event brand yet/);
    assert.doesNotMatch(html, /All events/);
  });
});
