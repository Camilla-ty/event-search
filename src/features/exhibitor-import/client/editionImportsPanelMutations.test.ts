import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyEditionImportDiscard } from "@/src/features/exhibitor-import/client/editionImportsPanelMutations";
import type { EditionImportContext } from "@/src/features/exhibitor-import/server/importUiData";

function panelData(
  overrides: Partial<EditionImportContext> = {},
): EditionImportContext {
  return {
    editionId: "edition-1",
    editionName: "Example 2026",
    seriesName: "Example Series",
    liveExhibitorCount: 12,
    activeBatch: {
      id: "batch-active",
      status: "review",
      source_filename: "exhibitors.xlsx",
    },
    batches: [
      {
        id: "batch-active",
        status: "review",
        source_filename: "exhibitors.xlsx",
        source_row_count: 40,
        created_at: "2026-07-01T00:00:00.000Z",
        event_edition_id: "edition-1",
        edition_name: "Example 2026",
        edition_year: 2026,
        series_name: "Example Series",
      },
      {
        id: "batch-old",
        status: "published",
        source_filename: "old.xlsx",
        source_row_count: 10,
        created_at: "2026-06-01T00:00:00.000Z",
        event_edition_id: "edition-1",
        edition_name: "Example 2026",
        edition_year: 2026,
        series_name: "Example Series",
      },
    ],
    ...overrides,
  };
}

describe("applyEditionImportDiscard", () => {
  it("clears the active import and marks the batch discarded", () => {
    const next = applyEditionImportDiscard(panelData(), "batch-active");

    assert.equal(next.activeBatch, null);
    assert.equal(next.batches[0]?.status, "discarded");
    assert.equal(next.batches[1]?.status, "published");
  });

  it("leaves unrelated batches and active state unchanged", () => {
    const next = applyEditionImportDiscard(panelData(), "batch-old");

    assert.notEqual(next.activeBatch, null);
    assert.equal(next.batches[0]?.status, "review");
    assert.equal(next.batches[1]?.status, "discarded");
  });
});
