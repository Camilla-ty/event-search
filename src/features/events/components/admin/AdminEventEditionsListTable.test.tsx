import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AdminEventEditionsListTable,
  editionHasAssignedVenue,
  editionHasLastReviewed,
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

describe("AdminEventEditionsListTable status helpers", () => {
  it("detects venue assignment and last-reviewed presence", () => {
    assert.equal(editionHasAssignedVenue(editionRow()), true);
    assert.equal(
      editionHasAssignedVenue(editionRow({ venue_id: null, venues: null })),
      false,
    );
    assert.equal(editionHasLastReviewed("2026-06-01T00:00:00.000Z"), true);
    assert.equal(editionHasLastReviewed(null), false);
  });
});

describe("AdminEventEditionsListTable", () => {
  it("renders numeric role counts and filled success status indicators", () => {
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

    assert.match(html, /href="\/admin\/events\/editions\/edition-1"/);
    assert.match(html, /after:absolute after:inset-0/);
    assert.match(html, /TOKEN2049 Singapore 2026/);
    assert.match(html, /aria-label="Venue assigned"/);
    assert.match(html, /aria-label="Last reviewed"/);
    assert.match(html, /rounded-full bg-brand-success[^"]*text-white/);
    assert.equal((html.match(/aria-label="Venue assigned"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-label="Last reviewed"/g) ?? []).length, 1);
    assert.doesNotMatch(html, /aria-label="Has sponsors"/);
    assert.doesNotMatch(html, /aria-label="Has exhibitors"/);

    assert.match(html, />2</);
    assert.match(html, />12</);
    assert.match(html, />5</);

    assert.match(html, /href="\/admin\/events\/editions\/edition-2"/);
    assert.match(html, /Future Shell 2025/);
    assert.equal((html.match(/>0</g) ?? []).length >= 3, true);
    assert.equal((html.match(/text-slate-400[^>]*>—</g) ?? []).length >= 3, true);
  });

  it("uses a single stretched name link per row without nested links", () => {
    const html = renderToStaticMarkup(
      <AdminEventEditionsListTable editions={[editionRow()]} />,
    );

    assert.equal((html.match(/<a /g) ?? []).length, 1);
    assert.doesNotMatch(html, /role="link"/);
  });
});
