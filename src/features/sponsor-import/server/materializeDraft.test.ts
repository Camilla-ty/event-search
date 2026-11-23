import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  materializeDraftLinksChunkWithDeps,
  type DraftLinkMaterializeRow,
  type UpsertDraftLinkForRowResult,
} from "./materializeDraft";
import { findDraftLinkInconsistencies } from "./sponsorImportAdmin";

const BATCH_ID = "batch-1";
const EDITION_ID = "edition-1";

function makeRow(
  overrides: Partial<DraftLinkMaterializeRow> &
    Pick<DraftLinkMaterializeRow, "id" | "excel_row_number">,
): DraftLinkMaterializeRow {
  return {
    decision_type: "use_matched",
    resolved_company_id: "company-1",
    proposed_company_id: "company-1",
    normalized_company_name: "Acme Corp",
    normalized_website: "https://acme.example",
    proposed_slug: "acme-corp",
    mapped_tier_rank: 2,
    mapped_tier_label: "Gold",
    draft_link_id: null,
    ...overrides,
  };
}

type DraftLinkRecord = {
  id: string;
  company_id: string;
  tier_rank: number;
  tier_label: string | null;
  source_import_row_id: string;
};

type TestStore = {
  rows: DraftLinkMaterializeRow[];
  links: Map<string, DraftLinkRecord>;
  linkedRowIds: Map<string, string>;
  nextLinkId: number;
  /** Rows a Review decision excluded; every other row is `resolved`. */
  excluded?: Set<string>;
};

function createTestDeps(store: TestStore) {
  return {
    fetchPendingRows: async (_batchId: string, cursor: number, limit: number) =>
      store.rows
        .filter((row) => row.draft_link_id === null && row.excel_row_number > cursor)
        .sort((a, b) => a.excel_row_number - b.excel_row_number)
        .slice(0, limit),
    countProgress: async () => {
      const total = store.rows.length;
      const withDraftLink = store.rows.filter((row) => row.draft_link_id !== null).length;
      return { total_resolved_rows: total, rows_with_draft_link: withDraftLink };
    },
    /** Mirrors `.eq("status", "resolved").is("draft_link_id", null).eq("resolved_company_id", companyId)`. */
    persistRowDraftLinkId: async (rowId: string, linkId: string, companyId: string) => {
      const row = store.rows.find((candidate) => candidate.id === rowId);
      if (
        !row ||
        store.excluded?.has(rowId) ||
        row.draft_link_id !== null ||
        row.resolved_company_id !== companyId
      ) {
        return false;
      }
      store.linkedRowIds.set(rowId, linkId);
      row.draft_link_id = linkId;
      return true;
    },
    reconcileDraftLink: async (linkId: string) => {
      const entry = [...store.links.entries()].find(([, link]) => link.id === linkId);
      if (!entry) return;
      const [companyId, link] = entry;
      const sources = store.rows.filter(
        (row) =>
          row.draft_link_id === linkId &&
          !store.excluded?.has(row.id) &&
          row.resolved_company_id === companyId,
      );
      if (sources.length === 0) {
        store.links.delete(companyId);
        return;
      }
      const best = sources.reduce((top, row) =>
        (row.mapped_tier_rank ?? 0) > (top.mapped_tier_rank ?? 0) ? row : top,
      );
      link.tier_rank = best.mapped_tier_rank ?? 0;
      link.tier_label = best.mapped_tier_label;
      link.source_import_row_id = best.id;
    },
    upsertDraftLinkForRow: async (params: {
      batchId: string;
      eventEditionId: string;
      row: DraftLinkMaterializeRow;
      companyId: string;
      tier: number;
    }): Promise<UpsertDraftLinkForRowResult> => {
      void params.batchId;
      void params.eventEditionId;
      const existing = store.links.get(params.companyId);
      if (!existing) {
        const linkId = `link-${store.nextLinkId++}`;
        store.links.set(params.companyId, {
          id: linkId,
          company_id: params.companyId,
          tier_rank: params.tier,
          tier_label: params.row.mapped_tier_label,
          source_import_row_id: params.row.id,
        });
        return { linkId, linkCreated: true, linkUpdated: false };
      }

      if (params.tier > existing.tier_rank) {
        existing.tier_rank = params.tier;
        existing.tier_label = params.row.mapped_tier_label;
        existing.source_import_row_id = params.row.id;
        return { linkId: existing.id, linkCreated: false, linkUpdated: true };
      }

      return { linkId: existing.id, linkCreated: false, linkUpdated: false };
    },
  };
}

describe("materializeDraftLinksChunkWithDeps", () => {
  it("links each pending row to a draft link", async () => {
    const store: TestStore = {
      rows: [makeRow({ id: "row-1", excel_row_number: 10 })],
      links: new Map(),
      linkedRowIds: new Map(),
      nextLinkId: 1,
    };

    const result = await materializeDraftLinksChunkWithDeps(
      BATCH_ID,
      EDITION_ID,
      { cursor: 0, limit: 50 },
      createTestDeps(store),
    );

    assert.equal(result.rows_linked, 1);
    assert.equal(result.links_created, 1);
    assert.equal(store.rows[0]?.draft_link_id, "link-1");
    assert.equal(result.done, true);
    assert.equal(result.next_cursor, null);
  });

  it("skips rows that already have draft_link_id on retry", async () => {
    const store: TestStore = {
      rows: [
        makeRow({ id: "row-1", excel_row_number: 10, draft_link_id: "existing-link" }),
        makeRow({ id: "row-2", excel_row_number: 20 }),
      ],
      links: new Map([
        [
          "company-1",
          {
            id: "existing-link",
            company_id: "company-1",
            tier_rank: 2,
            tier_label: "Gold",
            source_import_row_id: "row-1",
          },
        ],
      ]),
      linkedRowIds: new Map([["row-1", "existing-link"]]),
      nextLinkId: 2,
    };

    const result = await materializeDraftLinksChunkWithDeps(
      BATCH_ID,
      EDITION_ID,
      { cursor: 0, limit: 50 },
      createTestDeps(store),
    );

    assert.equal(result.examined_count, 1);
    assert.equal(result.skipped_count, 0);
    assert.equal(result.rows_linked, 1);
    assert.equal(store.rows[1]?.draft_link_id, "existing-link");
    assert.equal(store.links.size, 1);
  });

  it("can resume after partial failure", async () => {
    const store: TestStore = {
      rows: [
        makeRow({ id: "row-1", excel_row_number: 10 }),
        makeRow({
          id: "row-2",
          excel_row_number: 20,
          resolved_company_id: "company-2",
          proposed_company_id: "company-2",
        }),
      ],
      links: new Map([
        [
          "company-1",
          {
            id: "link-1",
            company_id: "company-1",
            tier_rank: 2,
            tier_label: "Gold",
            source_import_row_id: "row-1",
          },
        ],
      ]),
      linkedRowIds: new Map([["row-1", "link-1"]]),
      nextLinkId: 2,
    };
    store.rows[0]!.draft_link_id = "link-1";

    const deps = createTestDeps(store);
    const failOnRowTwo = {
      ...deps,
      persistRowDraftLinkId: async (rowId: string, linkId: string, companyId: string) => {
        if (rowId === "row-2") {
          throw new Error("simulated persist failure");
        }
        return deps.persistRowDraftLinkId(rowId, linkId, companyId);
      },
    };

    await assert.rejects(
      () =>
        materializeDraftLinksChunkWithDeps(
          BATCH_ID,
          EDITION_ID,
          { cursor: 0, limit: 50 },
          failOnRowTwo,
        ),
      /simulated persist failure/,
    );

    const resume = await materializeDraftLinksChunkWithDeps(
      BATCH_ID,
      EDITION_ID,
      { cursor: 10, limit: 50 },
      deps,
    );

    assert.equal(resume.rows_linked, 1);
    assert.equal(store.rows[1]?.draft_link_id, "link-2");
    assert.equal(resume.done, true);
  });

  it("uses max tier when the same company appears in multiple chunks", async () => {
    const store: TestStore = {
      rows: [
        makeRow({ id: "row-1", excel_row_number: 10, mapped_tier_rank: 2 }),
        makeRow({ id: "row-2", excel_row_number: 20, mapped_tier_rank: 5, mapped_tier_label: "Platinum" }),
      ],
      links: new Map(),
      linkedRowIds: new Map(),
      nextLinkId: 1,
    };

    const deps = createTestDeps(store);
    const first = await materializeDraftLinksChunkWithDeps(
      BATCH_ID,
      EDITION_ID,
      { cursor: 0, limit: 1 },
      deps,
    );
    const second = await materializeDraftLinksChunkWithDeps(
      BATCH_ID,
      EDITION_ID,
      { cursor: first.next_cursor ?? 0, limit: 50 },
      deps,
    );

    assert.equal(first.links_created, 1);
    assert.equal(second.links_updated, 1);
    assert.equal(store.links.get("company-1")?.tier_rank, 5);
    assert.equal(store.links.get("company-1")?.source_import_row_id, "row-2");
    assert.equal(store.rows[0]?.draft_link_id, store.rows[1]?.draft_link_id);
    assert.equal(second.done, true);
  });

  it("uses max tier when the same company appears twice in one chunk", async () => {
    const store: TestStore = {
      rows: [
        makeRow({ id: "row-1", excel_row_number: 10, mapped_tier_rank: 2 }),
        makeRow({ id: "row-2", excel_row_number: 20, mapped_tier_rank: 5, mapped_tier_label: "Platinum" }),
      ],
      links: new Map(),
      linkedRowIds: new Map(),
      nextLinkId: 1,
    };

    const result = await materializeDraftLinksChunkWithDeps(
      BATCH_ID,
      EDITION_ID,
      { cursor: 0, limit: 50 },
      createTestDeps(store),
    );

    assert.equal(result.links_created, 1);
    assert.equal(result.links_updated, 1);
    assert.equal(store.links.get("company-1")?.tier_rank, 5);
    assert.equal(store.rows[0]?.draft_link_id, store.rows[1]?.draft_link_id);
  });

  it("rejects rows missing resolved_company_id", async () => {
    const store: TestStore = {
      rows: [makeRow({ id: "row-1", excel_row_number: 10, resolved_company_id: null })],
      links: new Map(),
      linkedRowIds: new Map(),
      nextLinkId: 1,
    };

    await assert.rejects(
      () =>
        materializeDraftLinksChunkWithDeps(
          BATCH_ID,
          EDITION_ID,
          { cursor: 0, limit: 50 },
          createTestDeps(store),
        ),
      /missing company or tier/,
    );
  });

  it("rejects rows missing tier", async () => {
    const store: TestStore = {
      rows: [makeRow({ id: "row-1", excel_row_number: 10, mapped_tier_rank: null })],
      links: new Map(),
      linkedRowIds: new Map(),
      nextLinkId: 1,
    };

    await assert.rejects(
      () =>
        materializeDraftLinksChunkWithDeps(
          BATCH_ID,
          EDITION_ID,
          { cursor: 0, limit: 50 },
          createTestDeps(store),
        ),
      /missing company or tier/,
    );
  });

  it("paginates with cursor by excel_row_number", async () => {
    const store: TestStore = {
      rows: [
        makeRow({ id: "row-1", excel_row_number: 10, resolved_company_id: "company-1" }),
        makeRow({ id: "row-2", excel_row_number: 20, resolved_company_id: "company-2" }),
        makeRow({ id: "row-3", excel_row_number: 30, resolved_company_id: "company-3" }),
      ],
      links: new Map(),
      linkedRowIds: new Map(),
      nextLinkId: 1,
    };

    const first = await materializeDraftLinksChunkWithDeps(
      BATCH_ID,
      EDITION_ID,
      { cursor: 0, limit: 2 },
      createTestDeps(store),
    );

    assert.equal(first.examined_count, 2);
    assert.equal(first.rows_linked, 2);
    assert.equal(first.done, false);
    assert.equal(first.next_cursor, 20);

    const second = await materializeDraftLinksChunkWithDeps(
      BATCH_ID,
      EDITION_ID,
      { cursor: first.next_cursor ?? 0, limit: 2 },
      createTestDeps(store),
    );

    assert.equal(second.examined_count, 1);
    assert.equal(second.rows_linked, 1);
    assert.equal(second.done, true);
    assert.equal(second.next_cursor, null);
    assert.equal(store.linkedRowIds.size, 3);
  });
});

describe("materializeDraftLinksChunkWithDeps — Review decisions racing the chunk", () => {
  function racingStore(rows: DraftLinkMaterializeRow[], existingLinks: DraftLinkRecord[] = []): TestStore {
    return {
      rows,
      links: new Map(existingLinks.map((link) => [link.company_id, link])),
      linkedRowIds: new Map(),
      nextLinkId: 10,
      excluded: new Set(),
    };
  }

  /** Runs `review` once, between the chunk reading the rows and writing `rowId`'s link. */
  function withReviewBeforeLinking(store: TestStore, rowId: string, review: () => void) {
    const deps = createTestDeps(store);
    let reviewed = false;
    return {
      ...deps,
      upsertDraftLinkForRow: async (params: Parameters<typeof deps.upsertDraftLinkForRow>[0]) => {
        const upsert = await deps.upsertDraftLinkForRow(params);
        if (!reviewed && params.row.id === rowId) {
          reviewed = true;
          review();
        }
        return upsert;
      },
    };
  }

  it("a row excluded mid-chunk gets no link, and the link created for it is removed", async () => {
    const store = racingStore([makeRow({ id: "row-1", excel_row_number: 10 })]);
    const deps = withReviewBeforeLinking(store, "row-1", () => store.excluded!.add("row-1"));

    const result = await materializeDraftLinksChunkWithDeps(BATCH_ID, EDITION_ID, { cursor: 0, limit: 50 }, deps);

    assert.equal(store.rows[0]?.draft_link_id, null, "the excluded row is not linked");
    assert.equal(store.links.size, 0, "no link is left without a source row");
    assert.equal(result.conflict_count, 1);
    assert.equal(result.rows_linked, 0);
  });

  it("a row whose higher tier raised a shared link is undone when it is excluded mid-chunk", async () => {
    const store = racingStore(
      [
        makeRow({ id: "row-1", excel_row_number: 10, mapped_tier_rank: 2, mapped_tier_label: "Gold", draft_link_id: "link-1" }),
        makeRow({ id: "row-2", excel_row_number: 20, mapped_tier_rank: 5, mapped_tier_label: "Platinum" }),
      ],
      [{ id: "link-1", company_id: "company-1", tier_rank: 2, tier_label: "Gold", source_import_row_id: "row-1" }],
    );
    const deps = withReviewBeforeLinking(store, "row-2", () => store.excluded!.add("row-2"));

    const result = await materializeDraftLinksChunkWithDeps(BATCH_ID, EDITION_ID, { cursor: 0, limit: 50 }, deps);

    const link = store.links.get("company-1");
    assert.equal(link?.tier_rank, 2, "the link reflects only rows still pointing at it");
    assert.equal(link?.tier_label, "Gold");
    assert.equal(link?.source_import_row_id, "row-1");
    assert.equal(store.rows[1]?.draft_link_id, null);
    assert.equal(result.conflict_count, 1);
  });

  it("a row switched to another company mid-chunk is rescanned and linked to that company", async () => {
    const store = racingStore([
      makeRow({ id: "row-1", excel_row_number: 10 }),
      makeRow({ id: "row-2", excel_row_number: 20, resolved_company_id: "company-2" }),
    ]);
    const deps = withReviewBeforeLinking(store, "row-1", () => {
      store.rows[0]!.resolved_company_id = "company-chosen";
    });

    const first = await materializeDraftLinksChunkWithDeps(BATCH_ID, EDITION_ID, { cursor: 0, limit: 50 }, deps);

    assert.equal(first.conflict_count, 1);
    assert.equal(first.done, false);
    assert.equal(first.next_cursor, 0, "the conflicted range is rescanned");
    assert.equal(store.links.has("company-1"), false, "the link made for the old company is removed");

    const second = await materializeDraftLinksChunkWithDeps(
      BATCH_ID,
      EDITION_ID,
      { cursor: first.next_cursor ?? 0, limit: 50 },
      deps,
    );

    assert.equal(second.done, true);
    assert.equal(store.rows[0]?.draft_link_id, store.links.get("company-chosen")?.id);
  });
});

describe("findDraftLinkInconsistencies — finalize-time check", () => {
  const link = (id: string, company_id: string) => ({ id, company_id });
  const row = (id: string, status: string, resolved_company_id: string | null, draft_link_id: string | null) => ({
    id,
    status,
    resolved_company_id,
    draft_link_id,
  });

  it("accepts links that each have a resolved source row for the same company", () => {
    const result = findDraftLinkInconsistencies(
      [link("link-1", "company-1"), link("link-2", "company-2")],
      [
        row("row-1", "resolved", "company-1", "link-1"),
        row("row-2", "resolved", "company-1", "link-1"),
        row("row-3", "resolved", "company-2", "link-2"),
      ],
    );

    assert.deepEqual(result, { unbacked_link_ids: [], excluded_linked_row_ids: [] });
  });

  it("rejects a link with no source row", () => {
    const result = findDraftLinkInconsistencies([link("link-1", "company-1")], []);

    assert.deepEqual(result.unbacked_link_ids, ["link-1"]);
  });

  it("rejects a link whose only source row now resolves to another company", () => {
    const result = findDraftLinkInconsistencies(
      [link("link-1", "company-1")],
      [row("row-1", "resolved", "company-other", "link-1")],
    );

    assert.deepEqual(result.unbacked_link_ids, ["link-1"]);
  });

  it("rejects an excluded row that still carries a draft link", () => {
    const result = findDraftLinkInconsistencies(
      [link("link-1", "company-1")],
      [row("row-1", "resolved", "company-1", "link-1"), row("row-2", "excluded", "company-1", "link-1")],
    );

    assert.deepEqual(result, { unbacked_link_ids: [], excluded_linked_row_ids: ["row-2"] });
  });
});
