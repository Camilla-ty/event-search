import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  classifyEventTemporalBucket,
  compareEventSearchOrder,
  RECENTLY_ENDED_DAYS,
  scoreEventSearchRelevanceTier,
  sortEventExplorerResults,
} from "@/src/features/events/lib/eventExplorerOrdering";

const TODAY = "2026-06-11";

function makeEvent(
  overrides: Partial<EventRecord> & Pick<EventRecord, "id">,
): EventRecord {
  return {
    slug: null,
    name: overrides.name ?? "Sample Event",
    start_date: overrides.start_date ?? "2026-06-15",
    end_date: overrides.end_date ?? "2026-06-15",
    event_series: overrides.event_series ?? { name: "Sample Series", logo_url: null },
    cities: overrides.cities ?? {
      name: "Singapore",
      states: null,
      countries: { name: "Singapore" },
    },
    ...overrides,
  };
}

describe("scoreEventSearchRelevanceTier", () => {
  it("ranks exact event name above exact series name", () => {
    const exactEvent = makeEvent({
      id: "1",
      name: "Korea",
      event_series: { name: "Other Series", logo_url: null },
    });
    const exactSeries = makeEvent({
      id: "2",
      name: "Seoul Edition",
      event_series: { name: "Korea", logo_url: null },
    });

    assert.equal(scoreEventSearchRelevanceTier(exactEvent, "korea"), 1);
    assert.equal(scoreEventSearchRelevanceTier(exactSeries, "korea"), 2);
    assert.ok(
      compareEventSearchOrder(exactEvent, exactSeries, "korea", TODAY) < 0,
    );
  });

  it("ranks prefix and partial matches below exact matches", () => {
    const prefix = makeEvent({
      id: "1",
      name: "Korea Summit 2026",
      event_series: { name: "Summit Series", logo_url: null },
    });
    const partial = makeEvent({
      id: "2",
      name: "Asia Korea Expo",
      event_series: { name: "Expo Series", logo_url: null },
    });
    const cityOnly = makeEvent({
      id: "3",
      name: "Regional Show",
      event_series: { name: "Expo Series", logo_url: null },
      cities: {
        name: "Seoul",
        states: null,
        countries: { name: "South Korea" },
      },
    });

    assert.equal(scoreEventSearchRelevanceTier(prefix, "korea"), 3);
    assert.equal(scoreEventSearchRelevanceTier(partial, "korea"), 4);
    assert.equal(scoreEventSearchRelevanceTier(cityOnly, "korea"), 5);
  });

  it("ranks exact keyword matches at tier 2", () => {
    const keywordTagged = makeEvent({
      id: "ethcc",
      name: "EthCC Paris",
      event_series: { name: "EthCC", logo_url: null },
      series_keywords: [{ id: "kw-1", name: "DeFi", slug: "defi" }],
    });
    const partialName = makeEvent({
      id: "defi-week",
      name: "DeFi Week Paris",
      event_series: { name: "Conference Series", logo_url: null },
    });

    assert.equal(scoreEventSearchRelevanceTier(keywordTagged, "defi"), 2);
    assert.equal(scoreEventSearchRelevanceTier(partialName, "defi"), 3);
    assert.ok(
      compareEventSearchOrder(keywordTagged, partialName, "defi", TODAY) < 0,
    );
  });
});

describe("classifyEventTemporalBucket", () => {
  it("classifies ongoing, upcoming, recently ended, older ended, and dateless", () => {
    assert.equal(
      classifyEventTemporalBucket(
        { start_date: "2026-06-01", end_date: "2026-06-20" },
        TODAY,
      ),
      "ongoing",
    );
    assert.equal(
      classifyEventTemporalBucket(
        { start_date: "2026-07-01", end_date: "2026-07-03" },
        TODAY,
      ),
      "upcoming",
    );

    const recentEnd = subtractDays(TODAY, 30);
    assert.equal(
      classifyEventTemporalBucket(
        { start_date: subtractDays(TODAY, 40), end_date: recentEnd },
        TODAY,
      ),
      "recently_ended",
    );

    const oldEnd = subtractDays(TODAY, RECENTLY_ENDED_DAYS + 1);
    assert.equal(
      classifyEventTemporalBucket(
        { start_date: subtractDays(TODAY, RECENTLY_ENDED_DAYS + 30), end_date: oldEnd },
        TODAY,
      ),
      "older_ended",
    );

    assert.equal(classifyEventTemporalBucket({ start_date: null, end_date: null }, TODAY), "dateless");
  });
});

describe("compareEventSearchOrder temporal tie-break", () => {
  it("orders recently ended before ongoing before upcoming before older ended", () => {
    const recentlyEnded = makeEvent({
      id: "recent",
      name: "Recent Match",
      start_date: subtractDays(TODAY, 20),
      end_date: subtractDays(TODAY, 5),
      event_series: { name: "Korea Series", logo_url: null },
    });
    const ongoing = makeEvent({
      id: "ongoing",
      name: "Ongoing Match",
      start_date: subtractDays(TODAY, 2),
      end_date: subtractDays(TODAY, -2),
      event_series: { name: "Korea Series", logo_url: null },
    });
    const upcoming = makeEvent({
      id: "upcoming",
      name: "Upcoming Match",
      start_date: subtractDays(TODAY, -10),
      end_date: subtractDays(TODAY, -12),
      event_series: { name: "Korea Series", logo_url: null },
    });
    const olderEnded = makeEvent({
      id: "old",
      name: "Older Match",
      start_date: subtractDays(TODAY, 400),
      end_date: subtractDays(TODAY, RECENTLY_ENDED_DAYS + 10),
      event_series: { name: "Korea Series", logo_url: null },
    });

    const ordered = [olderEnded, upcoming, ongoing, recentlyEnded].sort((a, b) =>
      compareEventSearchOrder(a, b, "korea", TODAY),
    );

    assert.deepEqual(
      ordered.map((event) => event.id),
      ["recent", "ongoing", "upcoming", "old"],
    );
  });

  it("sorts recently ended editions by most recent end date first", () => {
    const newer = makeEvent({
      id: "newer",
      name: "Korea A",
      start_date: "2026-03-01",
      end_date: "2026-05-01",
      event_series: { name: "Korea", logo_url: null },
    });
    const older = makeEvent({
      id: "older",
      name: "Korea B",
      start_date: "2026-01-01",
      end_date: "2026-02-01",
      event_series: { name: "Korea", logo_url: null },
    });

    assert.ok(compareEventSearchOrder(newer, older, "korea", TODAY) < 0);
  });
});

describe("sortEventExplorerResults", () => {
  it("uses relevance order for recommended sort when query is present", () => {
    const events = [
      makeEvent({
        id: "city",
        name: "Regional Expo",
        event_series: { name: "Expo", logo_url: null },
        cities: {
          name: "Seoul",
          states: null,
          countries: { name: "Korea" },
        },
      }),
      makeEvent({
        id: "exact",
        name: "Korea",
        event_series: { name: "Summit", logo_url: null },
      }),
    ];

    const sorted = sortEventExplorerResults(events, {
      query: "korea",
      sortMode: "recommended",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["exact", "city"],
    );
  });

  it("uses chronological order for recommended sort without query", () => {
    const events = [
      makeEvent({ id: "later", name: "Later", start_date: "2026-08-01", end_date: "2026-08-02" }),
      makeEvent({ id: "earlier", name: "Earlier", start_date: "2026-05-01", end_date: "2026-05-02" }),
    ];

    const sorted = sortEventExplorerResults(events, {
      query: "",
      sortMode: "recommended",
      today: TODAY,
    });

    assert.deepEqual(
      sorted.map((event) => event.id),
      ["earlier", "later"],
    );
  });

  it("honors date and name overrides", () => {
    const events = [
      makeEvent({ id: "b", name: "Bravo", start_date: "2026-08-01" }),
      makeEvent({ id: "a", name: "Alpha", start_date: "2026-05-01" }),
    ];

    assert.deepEqual(
      sortEventExplorerResults(events, {
        query: "alpha",
        sortMode: "date",
        today: TODAY,
      }).map((event) => event.id),
      ["a", "b"],
    );

    assert.deepEqual(
      sortEventExplorerResults(events, {
        query: "alpha",
        sortMode: "name",
        today: TODAY,
      }).map((event) => event.id),
      ["a", "b"],
    );
  });
});

function subtractDays(isoDate: string, days: number): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}
