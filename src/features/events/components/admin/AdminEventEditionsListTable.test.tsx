import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AdminEventEditionsListTable,
  editionHasAssignedVenue,
  editionHasExhibitors,
  editionHasLastReviewed,
  editionHasSponsors,
} from "@/src/features/events/components/admin/AdminEventEditionsListTable";
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
    event_series: {
      id: "series-1",
      name: "TOKEN2049",
      slug: "token2049",
      logo_url: "event-series/series-1/logo.png",
    },
    venues: { id: "venue-1", name: "Marina Bay Sands", archived_at: null },
    live_sponsor_count: 12,
    organizer_count: 2,
    exhibitor_count: 5,
    ...overrides,
  };
}

describe("AdminEventEditionsListTable presence helpers", () => {
  it("detects venue, reviewed, sponsor, and exhibitor presence", () => {
    assert.equal(editionHasAssignedVenue(editionRow()), true);
    assert.equal(
      editionHasAssignedVenue(editionRow({ venue_id: null, venues: null })),
      false,
    );
    assert.equal(editionHasLastReviewed("2026-06-01T00:00:00.000Z"), true);
    assert.equal(editionHasLastReviewed(null), false);
    assert.equal(editionHasSponsors(3), true);
    assert.equal(editionHasSponsors(0), false);
    assert.equal(editionHasExhibitors(1), true);
    assert.equal(editionHasExhibitors(0), false);
  });
});

describe("AdminEventEditionsListTable", () => {
  it("renders the approved columns with stretch-link rows and presence marks", () => {
    const html = renderToStaticMarkup(
      <AdminEventEditionsListTable
        editions={[
          editionRow(),
          editionRow({
            id: "edition-2",
            name: "Future Shell 2025",
            event_series: null,
            venue_id: null,
            venues: null,
            last_reviewed_at: null,
            live_sponsor_count: 0,
            organizer_count: 0,
            exhibitor_count: 0,
          }),
        ]}
      />,
    );

    assert.match(html, />Event Edition</);
    assert.match(html, />Event Series</);
    assert.match(html, />Venue</);
    assert.match(html, />Last reviewed</);
    assert.match(html, />Organizers</);
    assert.match(html, />Sponsors</);
    assert.match(html, />Exhibitors</);
    assert.doesNotMatch(html, />Year</);
    assert.doesNotMatch(html, />City</);
    assert.doesNotMatch(html, />Actions</);
    assert.doesNotMatch(html, />View</);
    assert.doesNotMatch(html, /Live sponsors/i);

    assert.match(html, /href="\/admin\/events\/editions\/edition-1"/);
    assert.match(html, /after:absolute after:inset-0/);
    assert.match(html, /hover:bg-brand-primary-muted\/50/);
    assert.match(html, /TOKEN2049 Singapore 2026/);
    assert.match(html, /aria-label="Has venue"/);
    assert.match(html, /aria-label="Has last reviewed date"/);
    assert.match(html, /aria-label="Has sponsors"/);
    assert.match(html, /aria-label="Has exhibitors"/);
    assert.match(html, /text-brand-success/);
    assert.match(html, />2</);
    assert.doesNotMatch(html, />12</);
    assert.doesNotMatch(html, />5</);

    assert.match(html, /href="\/admin\/events\/editions\/edition-2"/);
    assert.match(html, /Future Shell 2025/);
    assert.match(html, />0</);
    assert.equal((html.match(/text-slate-400[^>]*>—</g) ?? []).length >= 4, true);
  });

  it("uses a single stretched name link per row without nested links", () => {
    const html = renderToStaticMarkup(
      <AdminEventEditionsListTable editions={[editionRow()]} />,
    );

    assert.equal((html.match(/<a /g) ?? []).length, 1);
    assert.doesNotMatch(html, /role="link"/);
  });
});
