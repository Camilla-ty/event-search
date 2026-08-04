import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AdminSeriesEditionsTable,
  formatSeriesEditionReviewedMark,
  formatSeriesEditionVenueName,
} from "@/src/features/events/components/admin/AdminSeriesEditionsTable";
import type { EventEditionListItem } from "@/src/features/events/server/eventEditionAdmin";

function editionRow(overrides: Partial<EventEditionListItem> = {}): EventEditionListItem {
  return {
    id: "edition-1",
    series_id: "series-1",
    year: 2026,
    name: "TOKEN2049 Singapore 2026",
    slug: "token2049-singapore-2026",
    start_date: null,
    end_date: null,
    website_url: null,
    logo_url: null,
    city_id: null,
    venue_id: "venue-1",
    last_reviewed_at: "2026-06-01T00:00:00.000Z",
    primary_source_url: null,
    sponsor_note_type: null,
    created_at: "2026-01-01T00:00:00.000Z",
    venues: { id: "venue-1", name: "Marina Bay Sands", archived_at: null },
    live_sponsor_count: 12,
    organizer_count: 2,
    exhibitor_count: 0,
    ...overrides,
  };
}

describe("AdminSeriesEditionsTable helpers", () => {
  it("marks reviewed editions with a check and unreviewed with an em dash", () => {
    assert.equal(formatSeriesEditionReviewedMark("2026-06-01T00:00:00.000Z"), "✓");
    assert.equal(formatSeriesEditionReviewedMark(null), "—");
    assert.equal(formatSeriesEditionReviewedMark(undefined), "—");
  });

  it("shows venue name or an em dash when missing", () => {
    assert.equal(
      formatSeriesEditionVenueName({
        id: "venue-1",
        name: "Marina Bay Sands",
        archived_at: null,
      }),
      "Marina Bay Sands",
    );
    assert.equal(formatSeriesEditionVenueName(null), "—");
    assert.equal(
      formatSeriesEditionVenueName({ id: "venue-2", name: "  ", archived_at: null }),
      "—",
    );
  });
});

describe("AdminSeriesEditionsTable", () => {
  it("renders Name, Venue, Reviewed, Live Sponsors, and Organizers without Year/City/Actions", () => {
    const html = renderToStaticMarkup(
      <AdminSeriesEditionsTable
        editions={[
          editionRow(),
          editionRow({
            id: "edition-2",
            name: "Future Shell 2025",
            last_reviewed_at: null,
            venues: null,
            live_sponsor_count: 0,
            organizer_count: 0,
          }),
        ]}
      />,
    );

    assert.match(html, />Name</);
    assert.match(html, />Venue</);
    assert.match(html, />Reviewed</);
    assert.match(html, />Live Sponsors</);
    assert.match(html, />Organizers</);
    assert.doesNotMatch(html, />Year</);
    assert.doesNotMatch(html, />City</);
    assert.doesNotMatch(html, />Actions</);
    assert.doesNotMatch(html, />View</);

    assert.match(html, /href="\/admin\/events\/editions\/edition-1"/);
    assert.match(html, /TOKEN2049 Singapore 2026/);
    assert.match(html, /after:absolute after:inset-0/);
    assert.match(html, /hover:bg-brand-primary-muted\/50/);
    assert.match(html, /Marina Bay Sands/);
    assert.match(html, /✓/);
    assert.match(html, />12</);
    assert.match(html, />2</);

    assert.match(html, /href="\/admin\/events\/editions\/edition-2"/);
    assert.match(html, /Future Shell 2025/);
    assert.match(html, /—/);
    assert.match(html, />0</);
    assert.equal((html.match(/href="\/admin\/events\/editions\//g) ?? []).length, 2);
  });

  it("uses a single stretched name link per row without nested links", () => {
    const html = renderToStaticMarkup(
      <AdminSeriesEditionsTable editions={[editionRow()]} />,
    );

    assert.match(html, /after:absolute after:inset-0 after:z-\[1\]/);
    assert.match(html, /focus-visible:ring-2 focus-visible:ring-brand-primary\/25/);
    assert.doesNotMatch(html, /role="link"/);
    assert.equal((html.match(/<a /g) ?? []).length, 1);
  });

  it("renders the empty state when there are no editions", () => {
    const html = renderToStaticMarkup(<AdminSeriesEditionsTable editions={[]} />);
    assert.match(html, /No event editions for this event series yet\./);
  });
});
