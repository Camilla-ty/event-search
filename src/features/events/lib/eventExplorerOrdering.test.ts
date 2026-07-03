import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  compareChronologicalOrderDesc,
  compareEventBrowseRecommendedOrder,
  compareRecentlyReviewedOrder,
  DEFAULT_EVENT_EXPLORER_SORT_MODE,
  sortEventExplorerResults,
} from "@/src/features/events/lib/eventExplorerOrdering";

const TODAY = "2026-06-25";

describe("DEFAULT_EVENT_EXPLORER_SORT_MODE", () => {
  it("defaults initial load and reset to Recommended", () => {
    assert.equal(DEFAULT_EVENT_EXPLORER_SORT_MODE, "recommended");
  });
});

function makeEvent(overrides: Partial<EventRecord> & Pick<EventRecord, "id">): EventRecord {
  return {
    id: overrides.id,
    slug: overrides.slug ?? null,
    name: overrides.name ?? "Sample Event",
    website_url: overrides.website_url ?? null,
    start_date: overrides.start_date ?? "2026-06-15",
    end_date: overrides.end_date ?? "2026-06-15",
    last_reviewed_at: overrides.last_reviewed_at ?? null,
    sponsor_count: overrides.sponsor_count ?? 0,
    event_series: overrides.event_series ?? { name: "Sample Series", logo_url: null },
    cities: overrides.cities ?? null,
  };
}

describe("compareEventBrowseRecommendedOrder", () => {
  it("prioritizes reviewed editions before unreviewed", () => {
    const reviewed = makeEvent({
      id: "reviewed",
      name: "Reviewed Old",
      start_date: "2022-01-01",
      end_date: "2022-01-03",
      last_reviewed_at: "2026-06-01",
      sponsor_count: 1,
    });
    const unreviewed = makeEvent({
      id: "unreviewed",
      name: "Unreviewed Recent",
      start_date: "2026-06-20",
      end_date: "2026-06-22",
      sponsor_count: 100,
    });

    assert.ok(compareEventBrowseRecommendedOrder(reviewed, unreviewed, TODAY) < 0);
  });

  it("orders temporal buckets within the same review group", () => {
    const recentlyEnded = makeEvent({
      id: "recent",
      name: "Recently Ended",
      start_date: "2026-06-10",
      end_date: "2026-06-12",
      last_reviewed_at: "2026-06-20",
    });
    const upcoming = makeEvent({
      id: "upcoming",
      name: "Upcoming",
      start_date: "2026-07-01",
      end_date: "2026-07-03",
      last_reviewed_at: "2026-06-20",
    });

    assert.ok(compareEventBrowseRecommendedOrder(recentlyEnded, upcoming, TODAY) < 0);
  });

  it("orders by sponsor count within the same bucket", () => {
    const moreSponsors = makeEvent({
      id: "more",
      name: "More Sponsors",
      start_date: "2026-06-10",
      end_date: "2026-06-12",
      last_reviewed_at: "2026-06-20",
      sponsor_count: 50,
    });
    const fewerSponsors = makeEvent({
      id: "fewer",
      name: "Fewer Sponsors",
      start_date: "2026-06-08",
      end_date: "2026-06-09",
      last_reviewed_at: "2026-06-20",
      sponsor_count: 10,
    });

    assert.ok(compareEventBrowseRecommendedOrder(moreSponsors, fewerSponsors, TODAY) < 0);
  });

  it("uses end_date DESC for recently ended tie-breaks", () => {
    const laterEnd = makeEvent({
      id: "later",
      name: "Later End",
      start_date: "2026-06-01",
      end_date: "2026-06-20",
      last_reviewed_at: "2026-06-20",
      sponsor_count: 5,
    });
    const earlierEnd = makeEvent({
      id: "earlier",
      name: "Earlier End",
      start_date: "2026-06-01",
      end_date: "2026-06-10",
      last_reviewed_at: "2026-06-20",
      sponsor_count: 5,
    });

    assert.ok(compareEventBrowseRecommendedOrder(laterEnd, earlierEnd, TODAY) < 0);
  });
});

describe("sortEventExplorerResults", () => {
  it("uses browse recommended order for empty query and recommended sort", () => {
    const events = [
      makeEvent({
        id: "old-unreviewed",
        name: "Old Unreviewed",
        start_date: "2022-01-01",
        end_date: "2022-01-03",
      }),
      makeEvent({
        id: "recent-reviewed",
        name: "Recent Reviewed",
        start_date: "2026-06-10",
        end_date: "2026-06-12",
        last_reviewed_at: "2026-06-20",
        sponsor_count: 20,
      }),
    ];

    const sorted = sortEventExplorerResults(events, {
      query: "",
      sortMode: "recommended",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["recent-reviewed", "old-unreviewed"],
    );
  });

  it("orders date_asc from oldest to newest start_date", () => {
    const events = [
      makeEvent({
        id: "recent-reviewed",
        name: "Recent Reviewed",
        start_date: "2026-06-10",
        end_date: "2026-06-12",
        last_reviewed_at: "2026-06-20",
        sponsor_count: 20,
      }),
      makeEvent({
        id: "old-unreviewed",
        name: "Old Unreviewed",
        start_date: "2022-01-01",
        end_date: "2022-01-03",
      }),
    ];

    const sorted = sortEventExplorerResults(events, {
      query: "",
      sortMode: "date_asc",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["old-unreviewed", "recent-reviewed"],
    );
  });

  it("orders date_desc from newest to oldest start_date", () => {
    const events = [
      makeEvent({
        id: "old-unreviewed",
        name: "Old Unreviewed",
        start_date: "2022-01-01",
        end_date: "2022-01-03",
      }),
      makeEvent({
        id: "recent-reviewed",
        name: "Recent Reviewed",
        start_date: "2026-06-10",
        end_date: "2026-06-12",
      }),
    ];

    const sorted = sortEventExplorerResults(events, {
      query: "",
      sortMode: "date_desc",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["recent-reviewed", "old-unreviewed"],
    );
  });

  it("places dateless editions last in date_asc and date_desc", () => {
    const events = [
      {
        ...makeEvent({
          id: "dateless",
          name: "Dateless Event",
        }),
        start_date: null,
        end_date: null,
      },
      makeEvent({
        id: "dated",
        name: "Dated Event",
        start_date: "2024-06-01",
        end_date: "2024-06-03",
      }),
    ];

    const asc = sortEventExplorerResults(events, {
      query: "",
      sortMode: "date_asc",
      today: TODAY,
    });
    const desc = sortEventExplorerResults(events, {
      query: "",
      sortMode: "date_desc",
      today: TODAY,
    });

    assert.deepEqual(
      asc.map((event) => event.id),
      ["dated", "dateless"],
    );
    assert.deepEqual(
      desc.map((event) => event.id),
      ["dated", "dateless"],
    );
  });

  it("uses name and id tie-breaks for equal start_date in date_desc", () => {
    const events = [
      makeEvent({
        id: "b-event",
        name: "Bravo Event",
        start_date: "2026-06-15",
        end_date: "2026-06-15",
      }),
      makeEvent({
        id: "a-event",
        name: "Alpha Event",
        start_date: "2026-06-15",
        end_date: "2026-06-15",
      }),
    ];

    assert.ok(compareChronologicalOrderDesc(events[0], events[1]) > 0);

    const sorted = sortEventExplorerResults(events, {
      query: "",
      sortMode: "date_desc",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["a-event", "b-event"],
    );
  });

  it("sorts alphabetically by event name", () => {
    const events = [
      makeEvent({ id: "b", name: "Bravo Event" }),
      makeEvent({ id: "a", name: "Alpha Event" }),
    ];

    const sorted = sortEventExplorerResults(events, {
      query: "",
      sortMode: "name",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["a", "b"],
    );
  });

  it("keeps search relevance first when query is present", () => {
    const events = [
      makeEvent({
        id: "partial",
        name: "Blockchain Week",
        start_date: "2022-01-01",
        end_date: "2022-01-03",
        last_reviewed_at: "2026-06-20",
        sponsor_count: 100,
      }),
      makeEvent({
        id: "exact",
        name: "KBW",
        event_series: { name: "Korea Blockchain Week", logo_url: null },
        start_date: "2026-06-10",
        end_date: "2026-06-12",
      }),
    ];

    const sorted = sortEventExplorerResults(events, {
      query: "Korea Blockchain Week",
      sortMode: "recommended",
      today: TODAY,
    });

    assert.equal(sorted[0]?.id, "exact");
  });

  it("orders reviewed editions by last_reviewed_at DESC", () => {
    const events = [
      makeEvent({
        id: "older-review",
        name: "Older Review",
        last_reviewed_at: "2026-06-01T00:00:00Z",
      }),
      makeEvent({
        id: "newer-review",
        name: "Newer Review",
        last_reviewed_at: "2026-06-20T00:00:00Z",
      }),
    ];

    const sorted = sortEventExplorerResults(events, {
      query: "",
      sortMode: "reviewed",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["newer-review", "older-review"],
    );
  });

  it("places unreviewed editions after reviewed editions", () => {
    const events = [
      makeEvent({
        id: "unreviewed",
        name: "Unreviewed",
      }),
      makeEvent({
        id: "reviewed",
        name: "Reviewed",
        last_reviewed_at: "2026-06-10T00:00:00Z",
      }),
    ];

    const sorted = sortEventExplorerResults(events, {
      query: "",
      sortMode: "reviewed",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["reviewed", "unreviewed"],
    );
  });

  it("uses name and id tie-breaks for equal last_reviewed_at values", () => {
    const events = [
      makeEvent({
        id: "b-event",
        name: "Bravo Event",
        last_reviewed_at: "2026-06-15T00:00:00Z",
      }),
      makeEvent({
        id: "a-event",
        name: "Alpha Event",
        last_reviewed_at: "2026-06-15T00:00:00Z",
      }),
    ];

    assert.ok(compareRecentlyReviewedOrder(events[0], events[1]) > 0);

    const sorted = sortEventExplorerResults(events, {
      query: "",
      sortMode: "reviewed",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["a-event", "b-event"],
    );
  });
});
