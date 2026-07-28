import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DISCOVER_MODULE_LIMIT,
  isUpcomingEdition,
  selectRecentlyReviewedEditions,
  selectUpcomingEditions,
  type DiscoverEditionCandidate,
} from "@/src/features/home/server/discoverEditionSelectors";

const TODAY = "2026-06-11";

function edition(
  overrides: Partial<DiscoverEditionCandidate>,
): DiscoverEditionCandidate {
  return {
    id: "edition-id",
    slug: "edition-slug",
    name: "Edition",
    year: 2026,
    start_date: null,
    end_date: null,
    locationLabel: "",
    event_series: null,
    last_reviewed_at: "2026-06-01T12:00:00Z",
    ...overrides,
  };
}

describe("isUpcomingEdition", () => {
  it("includes future events when start_date is on or after today", () => {
    assert.equal(
      isUpcomingEdition(
        { start_date: "2026-07-01", end_date: "2026-07-03" },
        TODAY,
      ),
      true,
    );
    assert.equal(
      isUpcomingEdition(
        { start_date: "2026-06-11", end_date: "2026-06-13" },
        TODAY,
      ),
      true,
    );
  });

  it("includes in-progress events when start_date <= today and end_date >= today", () => {
    assert.equal(
      isUpcomingEdition(
        { start_date: "2026-06-01", end_date: "2026-06-20" },
        TODAY,
      ),
      true,
    );
    assert.equal(
      isUpcomingEdition(
        { start_date: "2026-06-11", end_date: "2026-06-11" },
        TODAY,
      ),
      true,
    );
  });

  it("excludes past events", () => {
    assert.equal(
      isUpcomingEdition(
        { start_date: "2026-01-01", end_date: "2026-01-03" },
        TODAY,
      ),
      false,
    );
    assert.equal(
      isUpcomingEdition(
        { start_date: "2026-05-01", end_date: "2026-06-10" },
        TODAY,
      ),
      false,
    );
  });

  it("excludes dateless events", () => {
    assert.equal(
      isUpcomingEdition({ start_date: null, end_date: null }, TODAY),
      false,
    );
    assert.equal(
      isUpcomingEdition({ start_date: "", end_date: "" }, TODAY),
      false,
    );
  });
});

describe("selectUpcomingEditions", () => {
  it("sorts by start date ascending and respects the limit", () => {
    const editions = [
      edition({
        id: "3",
        slug: "future-late",
        name: "Future Late",
        start_date: "2026-10-01",
        end_date: "2026-10-03",
      }),
      edition({
        id: "1",
        slug: "in-progress",
        name: "In Progress",
        start_date: "2026-06-01",
        end_date: "2026-06-20",
      }),
      edition({
        id: "2",
        slug: "future-soon",
        name: "Future Soon",
        start_date: "2026-07-01",
        end_date: "2026-07-03",
      }),
      edition({
        id: "4",
        slug: "past",
        name: "Past",
        start_date: "2026-01-01",
        end_date: "2026-01-03",
      }),
      edition({
        id: "5",
        slug: "dateless",
        name: "Dateless",
        start_date: null,
        end_date: null,
      }),
    ];

    const result = selectUpcomingEditions(editions, {
      today: TODAY,
      limit: 2,
    });

    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((item) => item.slug),
      ["in-progress", "future-soon"],
    );
  });
});

describe("selectRecentlyReviewedEditions", () => {
  it("sorts by last_reviewed_at descending and respects the limit", () => {
    const editions = [
      edition({
        id: "1",
        slug: "oldest-review",
        name: "Oldest Review",
        last_reviewed_at: "2026-06-01T12:00:00Z",
      }),
      edition({
        id: "2",
        slug: "middle-review",
        name: "Middle Review",
        last_reviewed_at: "2026-06-05T12:00:00Z",
      }),
      edition({
        id: "3",
        slug: "newest-review",
        name: "Newest Review",
        last_reviewed_at: "2026-06-10T12:00:00Z",
      }),
    ];

    const result = selectRecentlyReviewedEditions(editions, { limit: 2 });

    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((item) => item.slug),
      ["newest-review", "middle-review"],
    );
    assert.equal(DISCOVER_MODULE_LIMIT, 6);
  });

  it("places unreviewed editions after reviewed editions", () => {
    const editions = [
      edition({
        id: "unreviewed",
        slug: "unreviewed",
        name: "Unreviewed",
        last_reviewed_at: null,
      }),
      edition({
        id: "reviewed",
        slug: "reviewed",
        name: "Reviewed",
        last_reviewed_at: "2026-06-10T00:00:00Z",
      }),
    ];

    const result = selectRecentlyReviewedEditions(editions, { limit: 2 });

    assert.deepEqual(
      result.map((item) => item.slug),
      ["reviewed", "unreviewed"],
    );
  });

  it("uses name and id tie-breaks for equal last_reviewed_at values", () => {
    const editions = [
      edition({
        id: "b",
        slug: "beta",
        name: "Beta",
        last_reviewed_at: "2026-06-15T00:00:00Z",
      }),
      edition({
        id: "a",
        slug: "alpha",
        name: "Alpha",
        last_reviewed_at: "2026-06-15T00:00:00Z",
      }),
    ];

    const result = selectRecentlyReviewedEditions(editions, { limit: 2 });

    assert.deepEqual(
      result.map((item) => item.slug),
      ["alpha", "beta"],
    );
  });
});
