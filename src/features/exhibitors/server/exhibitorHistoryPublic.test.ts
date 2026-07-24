import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatExhibitorHistoryTierLabel,
  groupExhibitorHistoryBySeries,
  shouldShowExhibitorHistorySection,
  type ExhibitorHistoryEditionEntry,
  type ExhibitorHistoryEvent,
} from "@/src/features/exhibitors/server/exhibitorHistoryModel";
import { getPublicExhibitorHistoryForCompany } from "@/src/features/exhibitors/server/exhibitorHistoryPublic";

function edition(
  partial: Partial<ExhibitorHistoryEvent> & {
    id: string;
    name: string;
    seriesId?: string;
    seriesName?: string;
    cities?: unknown;
  },
): ExhibitorHistoryEvent {
  const seriesId = partial.seriesId;
  const seriesName = partial.seriesName;
  const rest = { ...partial };
  delete rest.seriesId;
  delete rest.seriesName;
  delete rest.cities;
  return {
    slug: null,
    year: null,
    start_date: null,
    end_date: null,
    event_series:
      seriesId && seriesName
        ? { id: seriesId, name: seriesName }
        : null,
    cities: partial.cities ?? null,
    ...rest,
  } as ExhibitorHistoryEvent;
}

function entry(
  ed: ExhibitorHistoryEvent,
  tierRank: number | null = null,
  tierLabel: string | null = null,
): ExhibitorHistoryEditionEntry {
  return { edition: ed, tierRank, tierLabel };
}

describe("shouldShowExhibitorHistorySection", () => {
  it("hides when history is empty and shows when at least one displayable entry exists", () => {
    assert.equal(shouldShowExhibitorHistorySection([]), false);
    assert.equal(shouldShowExhibitorHistorySection(null), false);
    assert.equal(shouldShowExhibitorHistorySection(undefined), false);
    assert.equal(
      shouldShowExhibitorHistorySection([
        { series: { id: "s1", name: "Alpha" }, editions: [] },
      ]),
      false,
    );
    assert.equal(
      shouldShowExhibitorHistorySection([
        {
          series: { id: "s1", name: "Alpha" },
          editions: [
            entry(
              edition({
                id: "e1",
                name: "Alpha 2025",
                seriesId: "s1",
                seriesName: "Alpha",
              }),
            ),
          ],
        },
      ]),
      true,
    );
  });
});

describe("groupExhibitorHistoryBySeries", () => {
  it("groups by Event Brand, sorts brands A→Z, and editions by start_date then year desc", () => {
    const groups = groupExhibitorHistoryBySeries([
      entry(
        edition({
          id: "z-old",
          name: "Zeta 2023",
          seriesId: "z",
          seriesName: "Zeta Brand",
          start_date: "2023-01-01",
          year: 2023,
        }),
        1,
        "Gold",
      ),
      entry(
        edition({
          id: "a-new",
          name: "Alpha 2025",
          seriesId: "a",
          seriesName: "Alpha Brand",
          start_date: "2025-06-01",
          year: 2025,
        }),
        2,
        null,
      ),
      entry(
        edition({
          id: "z-new",
          name: "Zeta 2025",
          seriesId: "z",
          seriesName: "Zeta Brand",
          start_date: "2025-03-01",
          year: 2025,
        }),
        null,
        "  Platinum  ",
      ),
      entry(
        edition({
          id: "orphan",
          name: "No Brand",
          start_date: "2024-01-01",
          year: 2024,
        }),
      ),
    ]);

    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.series.name, "Alpha Brand");
    assert.equal(groups[1]?.series.name, "Zeta Brand");
    assert.deepEqual(
      groups[1]?.editions.map((e) => e.edition.id),
      ["z-new", "z-old"],
    );
  });

  it("orders editions with equal start_date by year descending", () => {
    const groups = groupExhibitorHistoryBySeries([
      entry(
        edition({
          id: "y2020",
          name: "Same Date 2020",
          seriesId: "s",
          seriesName: "Series",
          start_date: "2020-01-01",
          year: 2020,
        }),
      ),
      entry(
        edition({
          id: "y2022",
          name: "Same Date 2022",
          seriesId: "s",
          seriesName: "Series",
          start_date: "2020-01-01",
          year: 2022,
        }),
      ),
    ]);

    assert.deepEqual(
      groups[0]?.editions.map((e) => e.edition.id),
      ["y2022", "y2020"],
    );
  });

  it("places null start_date after dated editions and ties break by id", () => {
    const groups = groupExhibitorHistoryBySeries([
      entry(
        edition({
          id: "b-null",
          name: "No date B",
          seriesId: "s",
          seriesName: "Series",
          start_date: null,
          year: null,
        }),
      ),
      entry(
        edition({
          id: "a-null",
          name: "No date A",
          seriesId: "s",
          seriesName: "Series",
          start_date: null,
          year: null,
        }),
      ),
      entry(
        edition({
          id: "dated",
          name: "Dated",
          seriesId: "s",
          seriesName: "Series",
          start_date: "2024-05-01",
          year: 2024,
        }),
      ),
    ]);

    assert.deepEqual(
      groups[0]?.editions.map((e) => e.edition.id),
      ["dated", "a-null", "b-null"],
    );
  });

  it("excludes editions without a usable Event Brand", () => {
    const groups = groupExhibitorHistoryBySeries([
      entry(
        edition({
          id: "ok",
          name: "With brand",
          seriesId: "s",
          seriesName: "Series",
        }),
      ),
      entry(
        edition({
          id: "blank-series",
          name: "Blank series",
          seriesId: "   ",
          seriesName: "Name",
        }),
      ),
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.editions[0]?.edition.id, "ok");
  });
});

describe("formatExhibitorHistoryTierLabel", () => {
  it("prefers label only, defaults rank 1 to Exhibitor, and Tier N otherwise", () => {
    assert.equal(formatExhibitorHistoryTierLabel(1, "  Gold  "), "Gold");
    assert.equal(formatExhibitorHistoryTierLabel(1, null), "Exhibitor");
    assert.equal(formatExhibitorHistoryTierLabel(2, null), "Tier 2");
    assert.equal(formatExhibitorHistoryTierLabel(null, "   "), null);
    assert.equal(formatExhibitorHistoryTierLabel(null, null), null);
  });
});

describe("getPublicExhibitorHistoryForCompany", () => {
  it("returns empty history for a blank company id without throwing", async () => {
    assert.deepEqual(await getPublicExhibitorHistoryForCompany(""), []);
    assert.deepEqual(await getPublicExhibitorHistoryForCompany("   "), []);
  });
});
