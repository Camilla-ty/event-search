import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import {
  mapPublicVenueHubRow,
  partitionEditionsForVenueHub,
  sortPastEditionsNewestFirst,
  sortUpcomingEditionsSoonestFirst,
} from "./getVenueHubData";

function edition(
  partial: Partial<PublicEditionSummary> & Pick<PublicEditionSummary, "id" | "name">,
): PublicEditionSummary {
  return {
    slug: partial.slug ?? partial.id,
    year: partial.year ?? null,
    start_date: partial.start_date ?? null,
    end_date: partial.end_date ?? null,
    locationLabel: partial.locationLabel ?? "",
    event_series: partial.event_series ?? null,
    ...partial,
  };
}

describe("mapPublicVenueHubRow", () => {
  it("maps an active venue with city embed", () => {
    const venue = mapPublicVenueHubRow({
      id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
      name: "The Venetian Resort Las Vegas",
      slug: "the-venetian-resort-las-vegas",
      website_url: "https://example.com",
      address_text: "3355 S Las Vegas Blvd",
      logo_url: null,
      archived_at: null,
      cities: {
        name: "Las Vegas",
        states: { name: "Nevada" },
        countries: { name: "United States" },
      },
    });

    assert.ok(venue);
    assert.equal(venue?.name, "The Venetian Resort Las Vegas");
    assert.equal(venue?.slug, "the-venetian-resort-las-vegas");
    assert.match(venue?.locationLabel ?? "", /Las Vegas/);
  });

  it("returns null for archived venues", () => {
    assert.equal(
      mapPublicVenueHubRow({
        id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
        name: "Old Hall",
        slug: "old-hall",
        archived_at: "2026-01-01T00:00:00Z",
      }),
      null,
    );
  });

  it("returns null when name is missing", () => {
    assert.equal(
      mapPublicVenueHubRow({
        id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
        name: "  ",
        slug: "blank",
        archived_at: null,
      }),
      null,
    );
  });
});

describe("partitionEditionsForVenueHub", () => {
  const TODAY = "2026-07-17";

  it("splits upcoming soonest-first and past newest-first", () => {
    const editions = [
      edition({
        id: "past-old",
        name: "Past Old",
        start_date: "2024-01-10",
        end_date: "2024-01-12",
        year: 2024,
      }),
      edition({
        id: "upcoming-late",
        name: "Upcoming Late",
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        year: 2026,
      }),
      edition({
        id: "past-new",
        name: "Past New",
        start_date: "2025-06-01",
        end_date: "2025-06-02",
        year: 2025,
      }),
      edition({
        id: "upcoming-soon",
        name: "Upcoming Soon",
        start_date: "2026-08-01",
        end_date: "2026-08-02",
        year: 2026,
      }),
    ];

    const { upcoming, past } = partitionEditionsForVenueHub(editions, TODAY);

    assert.deepEqual(
      upcoming.map((row) => row.id),
      ["upcoming-soon", "upcoming-late"],
    );
    assert.deepEqual(
      past.map((row) => row.id),
      ["past-new", "past-old"],
    );
  });

  it("treats undated editions as past", () => {
    const { upcoming, past } = partitionEditionsForVenueHub(
      [edition({ id: "undated", name: "Undated", start_date: null, end_date: null })],
      TODAY,
    );

    assert.equal(upcoming.length, 0);
    assert.equal(past.length, 1);
  });
});

describe("venue edition sort helpers", () => {
  it("sorts upcoming soonest first", () => {
    const sorted = sortUpcomingEditionsSoonestFirst([
      edition({ id: "b", name: "B", start_date: "2026-10-01" }),
      edition({ id: "a", name: "A", start_date: "2026-08-01" }),
    ]);
    assert.deepEqual(
      sorted.map((row) => row.id),
      ["a", "b"],
    );
  });

  it("sorts past newest first", () => {
    const sorted = sortPastEditionsNewestFirst([
      edition({ id: "old", name: "Old", start_date: "2023-01-01", year: 2023 }),
      edition({ id: "new", name: "New", start_date: "2025-01-01", year: 2025 }),
    ]);
    assert.deepEqual(
      sorted.map((row) => row.id),
      ["new", "old"],
    );
  });
});
