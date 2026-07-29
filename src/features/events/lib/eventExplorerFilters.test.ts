import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventFilters, EventRecord } from "@/src/features/events/components/explorer/types";
import { filterEventRecords } from "@/src/features/events/lib/eventExplorerFilters";

const defaultFilters: EventFilters = {
  query: "",
  regions: [],
  startDate: "",
  endDate: "",
  topics: [],
};

function makeEvent(overrides: Partial<EventRecord> & Pick<EventRecord, "id">): EventRecord {
  return {
    id: overrides.id,
    series_id: overrides.series_id ?? null,
    slug: overrides.slug ?? null,
    name: overrides.name ?? "Sample Event",
    website_url: overrides.website_url ?? null,
    start_date: "start_date" in overrides ? overrides.start_date ?? null : "2026-06-15",
    end_date: "end_date" in overrides ? overrides.end_date ?? null : "2026-06-15",
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

  it("matches q search against series names", () => {
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, query: "token" }).map((event) => event.id),
      ["1"],
    );
  });

  it("matches website domains in q search", () => {
    assert.deepEqual(
      filterEventRecords(
        [
          makeEvent({
            id: "bw",
            name: "Permissionless",
            website_url: "https://blockworks.com/events",
            event_series: { name: "Blockworks", logo_url: null },
          }),
        ],
        { ...defaultFilters, query: "https://www.blockworks.com/" },
      ).map((event) => event.id),
      ["bw"],
    );
  });

  it("applies region and date overlap filters", () => {
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, regions: ["Singapore"] }).map(
        (event) => event.id,
      ),
      ["1"],
    );
    assert.deepEqual(
      filterEventRecords(events, {
        ...defaultFilters,
        regions: ["Singapore", "United Kingdom"],
      }).map((event) => event.id),
      ["1", "2"],
    );
    assert.deepEqual(
      filterEventRecords(events, { ...defaultFilters, regions: [] }).map((event) => event.id),
      ["1", "2"],
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

  it("excludes undated and end-only editions when a date filter is active", () => {
    const mixed = [
      ...events,
      makeEvent({ id: "tbc", name: "Date TBC", start_date: null, end_date: null }),
      makeEvent({
        id: "end-only",
        name: "End Only",
        start_date: null,
        end_date: "2026-07-02",
      }),
    ];

    assert.deepEqual(
      filterEventRecords(mixed, defaultFilters).map((event) => event.id),
      ["1", "2", "tbc", "end-only"],
    );
    assert.deepEqual(
      filterEventRecords(mixed, {
        ...defaultFilters,
        startDate: "2026-07-01",
        endDate: "2026-07-31",
      }).map((event) => event.id),
      ["2"],
    );
  });
});
