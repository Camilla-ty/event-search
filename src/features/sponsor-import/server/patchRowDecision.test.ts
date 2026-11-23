import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SponsorImportHttpError } from "./errors";
import {
  DUPLICATE_SIBLING_PATCH_FIELDS,
  LINKED_ROW_DECISION_MESSAGE,
  patchRowDecisionWithDeps,
  ROW_DECISION_CONFLICT_MESSAGE,
  type PatchRowDecisionDeps,
  type RowDecisionInput,
} from "./sponsorImportAdmin";

type FakeRow = {
  id: string;
  proposed_company_id: string | null;
  duplicate_cluster_key: string | null;
  normalized_domain: string | null;
  draft_link_id: string | null;
  status: string;
  resolved_company_id: string | null;
  decision_type: string | null;
  decision_source: string | null;
  decision_by: string | null;
  decision_at: string | null;
  decision_notes: string | null;
  duplicate_resolution: string | null;
  updated_at: string;
};

function fakeRow(id: string, overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id,
    proposed_company_id: "company-proposed",
    duplicate_cluster_key: null,
    normalized_domain: `${id}.example`,
    draft_link_id: null,
    status: "resolved",
    resolved_company_id: "company-proposed",
    decision_type: "use_matched",
    decision_source: "bulk_action",
    decision_by: "admin-0",
    decision_at: "2026-11-01T00:00:00.000Z",
    decision_notes: null,
    duplicate_resolution: null,
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * In-memory rows whose row writes mirror the Supabase filters: `.eq("id").eq("batch_id")
 * .is("draft_link_id", null)`, so a row that has gained a draft link is never written; a
 * sibling restore additionally needs `.eq("updated_at", writtenAt)`.
 */
function createFakeRows(rows: FakeRow[]) {
  const byId = new Map(rows.map((row) => [row.id, { ...row }]));
  const state = {
    domainLinks: [] as Array<{ decision_type: string; company: string | null | undefined }>,
    writes: [] as string[],
    restores: [] as string[],
  };
  const hooks: {
    /** Runs immediately before a row write's filters are evaluated. */
    beforeWrite?: (rowId: string) => void;
  } = {};

  const write = (rowId: string, patch: Record<string, unknown>): FakeRow | null => {
    hooks.beforeWrite?.(rowId);
    const row = byId.get(rowId);
    if (!row || row.draft_link_id !== null) return null;
    Object.assign(row, patch);
    state.writes.push(rowId);
    return { ...row };
  };

  const depsFor = (rowId: string): PatchRowDecisionDeps<FakeRow, FakeRow> => ({
    loadRow: async () => {
      const row = byId.get(rowId);
      return row ? { ...row } : null;
    },
    loadClusterRows: async (clusterKey) =>
      [...byId.values()]
        .filter((row) => row.duplicate_cluster_key === clusterKey)
        .map((row) => ({
          id: row.id,
          duplicate_cluster_key: row.duplicate_cluster_key,
          draft_link_id: row.draft_link_id,
          previous: Object.fromEntries(
            DUPLICATE_SIBLING_PATCH_FIELDS.map((field) => [field, row[field as keyof FakeRow] ?? null]),
          ),
        })),
    linkReviewedDomain: async (input) => {
      state.domainLinks.push({
        decision_type: input.decision_type,
        company: input.resolved_company_id ?? input.proposed_company_id,
      });
    },
    updateUnlinkedRow: async (targetRowId, patch) => write(targetRowId, patch),
    updateUnlinkedSibling: async (targetRowId, patch) => write(targetRowId, patch) !== null,
    restoreSibling: async (targetRowId, previous, writtenAt) => {
      const row = byId.get(targetRowId);
      if (!row || row.draft_link_id !== null || row.updated_at !== writtenAt) return false;
      Object.assign(row, previous);
      state.restores.push(targetRowId);
      return true;
    },
    present: async (saved) => saved,
    now: () => "2026-11-23T09:00:00.000Z",
  });

  const decide = (rowId: string, input: RowDecisionInput) =>
    patchRowDecisionWithDeps(rowId, "admin-1", input, depsFor(rowId));

  return {
    state,
    hooks,
    decide,
    row: (id: string) => ({ ...byId.get(id)! }),
    /** What a draft-link chunk does to a row it links. */
    link: (rowId: string, linkId: string) => {
      byId.get(rowId)!.draft_link_id = linkId;
    },
    /** A later write by someone else, e.g. another reviewer. */
    touch: (rowId: string, patch: Partial<FakeRow>) => {
      Object.assign(byId.get(rowId)!, patch);
    },
  };
}

async function assertRejected(
  promise: Promise<unknown>,
  status: number,
  message: string,
  details?: Record<string, unknown>,
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SponsorImportHttpError, "expected a SponsorImportHttpError");
    assert.equal(error.status, status);
    assert.equal(error.message, message);
    if (details) assert.deepEqual(error.details, details);
    return true;
  });
}

describe("patchRowDecisionWithDeps — rows with draft links", () => {
  it("excluding a linked row is rejected and nothing is written", async () => {
    const fake = createFakeRows([fakeRow("row-1", { draft_link_id: "link-1" })]);
    const before = fake.row("row-1");

    await assertRejected(
      fake.decide("row-1", { decision_type: "exclude" }),
      409,
      LINKED_ROW_DECISION_MESSAGE,
      { linked_row_ids: ["row-1"] },
    );

    assert.deepEqual(fake.row("row-1"), before);
    assert.deepEqual(fake.state.writes, []);
  });

  it("switching a linked row to another company is rejected before the company domain is linked", async () => {
    const fake = createFakeRows([fakeRow("row-1", { draft_link_id: "link-1" })]);
    const before = fake.row("row-1");

    await assertRejected(
      fake.decide("row-1", { decision_type: "choose_different", resolved_company_id: "company-other" }),
      409,
      LINKED_ROW_DECISION_MESSAGE,
    );

    assert.deepEqual(fake.row("row-1"), before);
    assert.deepEqual(fake.state.writes, []);
    assert.deepEqual(fake.state.domainLinks, [], "company_domains must not be written");
  });

  for (const input of [
    { decision_type: "use_matched" },
    { decision_type: "create_new" },
  ] satisfies RowDecisionInput[]) {
    it(`${input.decision_type} on a linked row is rejected`, async () => {
      const fake = createFakeRows([fakeRow("row-1", { draft_link_id: "link-1" })]);

      await assertRejected(fake.decide("row-1", input), 409, LINKED_ROW_DECISION_MESSAGE);

      assert.deepEqual(fake.state.writes, []);
    });
  }

  it("keeping a duplicate whose sibling is linked is rejected before any row is written", async () => {
    const fake = createFakeRows([
      fakeRow("row-1", { duplicate_cluster_key: "acme" }),
      fakeRow("row-2", { duplicate_cluster_key: "acme", draft_link_id: "link-2" }),
      fakeRow("row-3", { duplicate_cluster_key: "acme" }),
    ]);
    const siblingBefore = fake.row("row-2");

    await assertRejected(
      fake.decide("row-1", { decision_type: "use_matched", duplicate_resolution: "kept" }),
      409,
      LINKED_ROW_DECISION_MESSAGE,
      { linked_row_ids: ["row-2"] },
    );

    assert.deepEqual(fake.row("row-2"), siblingBefore);
    assert.deepEqual(fake.state.writes, [], "neither the survivor nor other siblings may change");
    assert.deepEqual(fake.state.domainLinks, []);
  });

  it("a row that gains a draft link after it was read is not written", async () => {
    const fake = createFakeRows([fakeRow("row-1")]);
    // A draft-link chunk links the row between the read and the conditional update.
    fake.hooks.beforeWrite = (rowId) => fake.link(rowId, "link-late");

    await assertRejected(
      fake.decide("row-1", { decision_type: "exclude" }),
      409,
      ROW_DECISION_CONFLICT_MESSAGE,
      { row_id: "row-1" },
    );

    assert.equal(fake.row("row-1").status, "resolved");
    assert.deepEqual(fake.state.writes, []);
  });

  it("a sibling that gains a draft link after the cluster was read is not excluded", async () => {
    const fake = createFakeRows([
      fakeRow("row-1", { duplicate_cluster_key: "acme" }),
      fakeRow("row-2", { duplicate_cluster_key: "acme" }),
    ]);
    fake.hooks.beforeWrite = (rowId) => {
      if (rowId === "row-2") fake.link("row-2", "link-late");
    };

    await assertRejected(
      fake.decide("row-1", { decision_type: "use_matched", duplicate_resolution: "kept" }),
      409,
      ROW_DECISION_CONFLICT_MESSAGE,
      { row_id: "row-2" },
    );

    assert.equal(fake.row("row-2").status, "resolved", "the linked sibling keeps its status");
    assert.equal(fake.state.writes.includes("row-2"), false);
    assert.equal(fake.state.writes.includes("row-1"), false, "the survivor is never written");
  });
});

describe("patchRowDecisionWithDeps — duplicate clusters are never left partly written", () => {
  function cluster() {
    return createFakeRows([
      fakeRow("row-1", { duplicate_cluster_key: "acme", status: "needs_review", duplicate_resolution: "pending" }),
      fakeRow("row-2", { duplicate_cluster_key: "acme", status: "needs_review", duplicate_resolution: "pending" }),
      fakeRow("row-3", { duplicate_cluster_key: "acme", status: "needs_review", duplicate_resolution: "pending" }),
    ]);
  }

  it("excludes every sibling before the survivor is written", async () => {
    const fake = cluster();

    await fake.decide("row-1", { decision_type: "use_matched", duplicate_resolution: "kept" });

    assert.deepEqual(fake.state.writes, ["row-2", "row-3", "row-1"]);
    assert.equal(fake.row("row-1").duplicate_resolution, "kept");
    assert.equal(fake.row("row-2").status, "excluded");
    assert.equal(fake.row("row-3").status, "excluded");
  });

  it("a later sibling failing puts back the siblings already excluded and never writes the survivor", async () => {
    const fake = cluster();
    const before = { "row-1": fake.row("row-1"), "row-2": fake.row("row-2"), "row-3": fake.row("row-3") };
    fake.hooks.beforeWrite = (rowId) => {
      if (rowId === "row-3") fake.link("row-3", "link-late");
    };

    await assertRejected(
      fake.decide("row-1", { decision_type: "use_matched", duplicate_resolution: "kept" }),
      409,
      ROW_DECISION_CONFLICT_MESSAGE,
      { row_id: "row-3" },
    );

    assert.deepEqual(fake.state.restores, ["row-2"]);
    assert.deepEqual(fake.row("row-1"), before["row-1"], "the survivor is untouched");
    assert.deepEqual(fake.row("row-2"), before["row-2"], "the excluded sibling is restored exactly");
    assert.deepEqual(fake.row("row-3"), { ...before["row-3"], draft_link_id: "link-late" });
  });

  it("a survivor failing puts back every sibling", async () => {
    const fake = cluster();
    const before = { "row-2": fake.row("row-2"), "row-3": fake.row("row-3") };
    fake.hooks.beforeWrite = (rowId) => {
      if (rowId === "row-1") fake.link("row-1", "link-late");
    };

    await assertRejected(
      fake.decide("row-1", { decision_type: "use_matched", duplicate_resolution: "kept" }),
      409,
      ROW_DECISION_CONFLICT_MESSAGE,
      { row_id: "row-1" },
    );

    assert.deepEqual(fake.state.restores, ["row-3", "row-2"]);
    assert.deepEqual(fake.row("row-2"), before["row-2"]);
    assert.deepEqual(fake.row("row-3"), before["row-3"]);
  });

  it("a restore never overwrites a sibling someone else changed in the meantime", async () => {
    const fake = cluster();
    fake.hooks.beforeWrite = (rowId) => {
      if (rowId !== "row-3") return;
      fake.touch("row-2", { status: "resolved", decision_type: "create_new", updated_at: "2026-11-23T09:00:05.000Z" });
      fake.link("row-3", "link-late");
    };

    await assertRejected(
      fake.decide("row-1", { decision_type: "use_matched", duplicate_resolution: "kept" }),
      409,
      ROW_DECISION_CONFLICT_MESSAGE,
    );

    assert.deepEqual(fake.state.restores, []);
    assert.equal(fake.row("row-2").decision_type, "create_new", "the later decision stands");
  });
});

describe("patchRowDecisionWithDeps — rows without draft links", () => {
  it("excludes an unlinked row", async () => {
    const fake = createFakeRows([fakeRow("row-1")]);

    const saved = await fake.decide("row-1", { decision_type: "exclude" });

    assert.equal(saved.status, "excluded");
    assert.equal(saved.resolved_company_id, null);
    assert.deepEqual(fake.state.writes, ["row-1"]);
  });

  it("switches an unlinked row to another company and links the reviewed domain", async () => {
    const fake = createFakeRows([fakeRow("row-1")]);

    const saved = await fake.decide("row-1", {
      decision_type: "choose_different",
      resolved_company_id: "company-other",
    });

    assert.equal(saved.status, "resolved");
    assert.equal(saved.resolved_company_id, "company-other");
    assert.deepEqual(fake.state.domainLinks, [{ decision_type: "choose_different", company: "company-other" }]);
  });

  it("keeping a duplicate excludes its unlinked siblings", async () => {
    const fake = createFakeRows([
      fakeRow("row-1", { duplicate_cluster_key: "acme" }),
      fakeRow("row-2", { duplicate_cluster_key: "acme" }),
      fakeRow("other", { duplicate_cluster_key: "other" }),
    ]);

    const saved = await fake.decide("row-1", { decision_type: "use_matched", duplicate_resolution: "kept" });

    assert.equal(saved.duplicate_resolution, "kept");
    assert.equal(fake.row("row-2").status, "excluded");
    assert.equal(fake.row("other").status, "resolved");
    assert.deepEqual([...fake.state.writes].sort(), ["row-1", "row-2"]);
  });

  it("a missing row is a 404", async () => {
    const fake = createFakeRows([]);

    await assertRejected(fake.decide("row-1", { decision_type: "exclude" }), 404, "Row not found.");
  });
});