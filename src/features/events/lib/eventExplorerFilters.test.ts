import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventFilters, EventRecord } from "@/src/features/events/components/explorer/types";
import { filterEventRecords } from "@/src/features/events/lib/eventExplorerFilters";

const defaultFilters: EventFilters = {
  query: "",
  series: "all",
  region: "all",
  startDate: "",
  endDate: "",
  topic: "",
};

function makeEvent(overrides: Partial<EventRecord> & Pick<EventRecord, "id">): EventRecord {
  return {
    id: overrides.id,
    slug: overrides.slug ?? null,
    name: overrides.name ?? "Sample Event",
    start_date: overrides.start_date ?? "2026-06-15",
    end_date: overrides.end_date ?? "2026-06-15",
    event_series: overrides.event_series ?? { name: "Sample Series", logo_url: null },
    cities: overrides.cities ?? {
      name: "Singapore",
      states: null,
      countries: { name: "Singapore" },
    },
  };
}

describe("filterEventRecords", () => {
  const events = [
    makeEvent({
      id: "1",
      name: "TOKEN2049 Singapore",
      event_series: { name: "TOKEN2049", logo_url: null },
    }),
    makeEvent({
      id: "2",
      name: "FinTech Week",
      event_series: { name: "FinTech Week", logo_url: null },
      start_date: "2026-07-01",
      end_date: "2026-07-03",
      cities: {
        name: "London",
        states: null,
        countries: { name: "United Kingdom" },
      },
    }),
  ];

  it("matches search against event, city, country, and series names", () => {
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, query: "token" }).map((event) => event.id),
      ["1"],
    );
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, query: "fintech week" }).map(
        (event) => event.id,
      ),
      ["2"],
    );
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, query: "london" }).map((event) => event.id),
      ["2"],
    );
    assert.deepEqual(
      filterEventRecords(
        [
          makeEvent({
            id: "3",
            name: "Singapore Edition 2026",
            event_series: { name: "UniqueSeriesName", logo_url: null },
          }),
        ],
        { ...defaultFilters, query: "uniqueseriesname" },
      ).map((event) => event.id),
      ["3"],
    );
  });

  it("filters by event series", () => {
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, series: "TOKEN2049" }).map(
        (event) => event.id,
      ),
      ["1"],
    );
  });

  it("applies region and date overlap filters", () => {
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, region: "Singapore" }).map(
        (event) => event.id,
      ),
      ["1"],
    );
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, startDate: "2026-07-02" }).map(
        (event) => event.id,
      ),
      ["2"],
    );
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, endDate: "2026-06-20" }).map(
        (event) => event.id,
      ),
      ["1"],
    );
  });
});
