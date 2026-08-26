import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  applyExhibitorTierDisplayOrder,
  applyRefetchedExhibitorRoster,
  computeMoveOrderedLinkIdsForExhibitors,
  getDirtyExhibitorTierOrders,
  isExhibitorRosterOrderDirty,
  reorderLinkIdsByDrag,
  resolveExhibitorDragReorder,
} from "@/src/features/exhibitors/lib/liveExhibitorReorderClient";
import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";

function exhibitor(
  id: string,
  tierRank: number | null,
  displayOrder: number | null,
  companyId = `company-${id}`,
): LiveExhibitorRow {
  return {
    id,
    company_id: companyId,
    tier_rank: tierRank,
    tier_label: null,
    display_order: displayOrder,
    companies: null,
  };
}

describe("liveExhibitorReorderClient — local draft moves", () => {
  it("moving an exhibitor updates draft display order without needing a persist payload for unchanged saved", () => {
    const saved = [exhibitor("a", 1, 1), exhibitor("b", 1, 2), exhibitor("c", 1, 3)];
    const nextIds = computeMoveOrderedLinkIdsForExhibitors(saved, saved[1]!, "up");
    assert.deepEqual(nextIds, ["b", "a", "c"]);

    const draft = applyExhibitorTierDisplayOrder(saved, 1, nextIds!);
    assert.deepEqual(
      draft.map((row) => ({ id: row.id, display_order: row.display_order })),
      [
        { id: "a", display_order: 2 },
        { id: "b", display_order: 1 },
        { id: "c", display_order: 3 },
      ],
    );
    assert.equal(isExhibitorRosterOrderDirty(saved, draft), true);
    // Saved roster is untouched — move is local-only until Save.
    assert.deepEqual(
      saved.map((row) => row.display_order),
      [1, 2, 3],
    );
  });

  it("Save payload is the final dirty draft order only", () => {
    const saved = [
      exhibitor("a", 1, 1),
      exhibitor("b", 1, 2),
      exhibitor("c", 1, 3),
      exhibitor("d", 2, 1),
    ];
    const moved = computeMoveOrderedLinkIdsForExhibitors(saved, saved[2]!, "up");
    assert.deepEqual(moved, ["a", "c", "b"]);
    const draft = applyExhibitorTierDisplayOrder(saved, 1, moved!);

    const dirty = getDirtyExhibitorTierOrders(saved, draft);
    assert.deepEqual(dirty, [{ tier_rank: 1, ordered_link_ids: ["a", "c", "b"] }]);
  });

  it("unchanged state does not produce a save payload", () => {
    const roster = [exhibitor("a", 1, 1), exhibitor("b", 1, 2)];
    assert.deepEqual(getDirtyExhibitorTierOrders(roster, roster), []);
    assert.equal(isExhibitorRosterOrderDirty(roster, roster), false);
  });

  it("failed save refetch preserves a recoverable dirty draft", () => {
    const saved = [exhibitor("a", 1, 1), exhibitor("b", 1, 2), exhibitor("c", 1, 3)];
    const moveIds = computeMoveOrderedLinkIdsForExhibitors(saved, saved[2]!, "up");
    const draft = applyExhibitorTierDisplayOrder(saved, 1, moveIds!);
    assert.deepEqual(
      getDirtyExhibitorTierOrders(saved, draft)[0]?.ordered_link_ids,
      ["a", "c", "b"],
    );

    // Server still has original order (failed persist).
    const fresh = [exhibitor("a", 1, 1), exhibitor("b", 1, 2), exhibitor("c", 1, 3)];
    const next = applyRefetchedExhibitorRoster(fresh, saved, draft);

    assert.deepEqual(
      next.savedRoster.map((row) => row.id),
      ["a", "b", "c"],
    );
    assert.deepEqual(
      getDirtyExhibitorTierOrders(next.savedRoster, next.draftRoster)[0]?.ordered_link_ids,
      ["a", "c", "b"],
    );
    assert.equal(isExhibitorRosterOrderDirty(next.savedRoster, next.draftRoster), true);
  });

  it("clean refetch syncs both saved and draft", () => {
    const saved = [exhibitor("a", 1, 1)];
    const draft = [exhibitor("a", 1, 1)];
    const fresh = [exhibitor("a", 1, 1), exhibitor("b", 1, 2)];
    const next = applyRefetchedExhibitorRoster(fresh, saved, draft);
    assert.deepEqual(next.savedRoster, fresh);
    assert.deepEqual(next.draftRoster, fresh);
  });
});

describe("reorderLinkIdsByDrag", () => {
  const orderedIds = ["a", "b", "c", "d"];

  it("moves an item down within the tier", () => {
    assert.deepEqual(reorderLinkIdsByDrag(orderedIds, "b", "d"), ["a", "c", "d", "b"]);
  });

  it("moves an item up within the tier", () => {
    assert.deepEqual(reorderLinkIdsByDrag(orderedIds, "d", "a"), ["d", "a", "b", "c"]);
  });

  it("returns null when dropping on the same row", () => {
    assert.equal(reorderLinkIdsByDrag(orderedIds, "b", "b"), null);
  });

  it("returns null when an id is missing", () => {
    assert.equal(reorderLinkIdsByDrag(orderedIds, "missing", "b"), null);
  });
});

describe("resolveExhibitorDragReorder", () => {
  const roster = [
    exhibitor("a", 1, 1),
    exhibitor("b", 1, 2),
    exhibitor("c", 1, 3),
    exhibitor("d", 2, 1),
    exhibitor("u1", null, 1),
    exhibitor("u2", null, 2),
  ];

  it("reorders within the same ranked tier", () => {
    assert.deepEqual(
      resolveExhibitorDragReorder({
        exhibitors: roster,
        activeLinkId: "a",
        overLinkId: "c",
      }),
      { tierRank: 1, orderedLinkIds: ["b", "c", "a"] },
    );
  });

  it("reorders within the unranked tier", () => {
    assert.deepEqual(
      resolveExhibitorDragReorder({
        exhibitors: roster,
        activeLinkId: "u2",
        overLinkId: "u1",
      }),
      { tierRank: null, orderedLinkIds: ["u2", "u1"] },
    );
  });

  it("returns null when dropping onto a different tier", () => {
    assert.equal(
      resolveExhibitorDragReorder({
        exhibitors: roster,
        activeLinkId: "a",
        overLinkId: "d",
      }),
      null,
    );
  });

  it("returns null when dropping onto the same row", () => {
    assert.equal(
      resolveExhibitorDragReorder({
        exhibitors: roster,
        activeLinkId: "a",
        overLinkId: "a",
      }),
      null,
    );
  });

  it("returns null when reorder is disabled", () => {
    assert.equal(
      resolveExhibitorDragReorder({
        exhibitors: roster,
        activeLinkId: "a",
        overLinkId: "c",
        reorderDisabled: true,
      }),
      null,
    );
  });

  it("applies a same-tier drag to draft display_order without changing saved rows", () => {
    const saved = [exhibitor("a", 1, 1), exhibitor("b", 1, 2), exhibitor("c", 1, 3)];
    const resolved = resolveExhibitorDragReorder({
      exhibitors: saved,
      activeLinkId: "c",
      overLinkId: "a",
    });
    assert.deepEqual(resolved?.orderedLinkIds, ["c", "a", "b"]);

    const draft = applyExhibitorTierDisplayOrder(saved, resolved!.tierRank, resolved!.orderedLinkIds);
    assert.deepEqual(
      draft.map((row) => ({ id: row.id, display_order: row.display_order })),
      [
        { id: "a", display_order: 2 },
        { id: "b", display_order: 3 },
        { id: "c", display_order: 1 },
      ],
    );
    assert.deepEqual(
      saved.map((row) => row.display_order),
      [1, 2, 3],
    );
    assert.deepEqual(getDirtyExhibitorTierOrders(saved, draft), [
      { tier_rank: 1, ordered_link_ids: ["c", "a", "b"] },
    ]);
  });
});

describe("EditionExhibitorsPanel reorder wiring (UX-003)", () => {
  const panelSource = readFileSync(
    path.join(
      process.cwd(),
      "src/features/exhibitors/components/admin/EditionExhibitorsPanel.tsx",
    ),
    "utf8",
  );

  it("moves update local draft only — handleMove does not fetch", () => {
    const moveFn = panelSource.match(
      /function handleMove\([\s\S]*?\n  \}/,
    )?.[0];
    assert.ok(moveFn, "handleMove should exist");
    assert.equal(moveFn.includes("fetch("), false);
    assert.match(moveFn, /handleLocalReorderTier/);
    assert.match(moveFn, /computeMoveOrderedLinkIdsForExhibitors/);
  });

  it("Save persists dirty draft tiers via reorder API and no-ops when unchanged", () => {
    const saveFn = panelSource.match(
      /async function handleSaveOrder\(\) \{[\s\S]*?\n  \}/,
    )?.[0];
    assert.ok(saveFn, "handleSaveOrder should exist");
    assert.match(saveFn, /getDirtyExhibitorTierOrders/);
    assert.match(saveFn, /dirtyTiers\.length === 0/);
    assert.match(saveFn, /exhibitors\/reorder/);
    assert.match(saveFn, /setSavedRoster\(draftRoster\)/);
  });

  it("failed saves refetch while preserving recoverable draft via applyRefetchedExhibitorRoster", () => {
    assert.match(panelSource, /applyRefetchedExhibitorRoster/);
    assert.match(panelSource, /Failed to save order/);
    assert.match(panelSource, /refetchExhibitorsAndSyncRoster/);
  });

  it("shows sponsor-style save footer for unsaved / saving / saved / error states", () => {
    assert.match(panelSource, /LiveSponsorOrderSaveFooter/);
    assert.match(panelSource, /resolveOrderSaveBarState/);
    assert.match(panelSource, /Order modified|unsaved/);
    assert.match(panelSource, /beforeunload/);
  });

  it("wires drag-and-drop to local draft reorder and disables it while saving", () => {
    assert.match(panelSource, /EditionLiveExhibitorsQARoster/);
    assert.match(panelSource, /onReorderTier/);
    assert.match(panelSource, /handleLocalReorderTier/);
    assert.match(panelSource, /reorderDisabled=\{reorderDisabled\}/);
    assert.match(panelSource, /const reorderDisabled = isSaving/);
    assert.doesNotMatch(
      panelSource.match(/onReorderTier=\{[\s\S]*?\}/)?.[0] ?? "",
      /fetch\(/,
    );
  });
});
