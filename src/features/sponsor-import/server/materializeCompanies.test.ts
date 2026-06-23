import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  materializeCompaniesChunkWithDeps,
  type MaterializeCompanyRow,
} from "./materializeCompanies";

const BATCH_ID = "batch-1";

function makeRow(
  overrides: Partial<MaterializeCompanyRow> & Pick<MaterializeCompanyRow, "id" | "excel_row_number">,
): MaterializeCompanyRow {
  return {
    decision_type: "create_new",
    resolved_company_id: null,
    proposed_company_id: null,
    normalized_company_name: "Acme Corp",
    normalized_website: "https://acme.example",
    proposed_slug: "acme-corp",
    ...overrides,
  };
}

type TestStore = {
  rows: MaterializeCompanyRow[];
  persisted: Map<string, string>;
  createCalls: string[];
};

function createTestDeps(store: TestStore) {
  return {
    fetchPendingRows: async (_batchId: string, cursor: number, limit: number) =>
      store.rows
        .filter((row) => row.resolved_company_id === null && row.excel_row_number > cursor)
        .sort((a, b) => a.excel_row_number - b.excel_row_number)
        .slice(0, limit),
    countProgress: async () => {
      const total = store.rows.length;
      const withId = store.rows.filter((row) => row.resolved_company_id !== null).length;
      return { total_resolved_rows: total, rows_with_company_id: withId };
    },
    persistRowCompanyId: async (rowId: string, companyId: string) => {
      store.persisted.set(rowId, companyId);
      const row = store.rows.find((candidate) => candidate.id === rowId);
      if (row) {
        row.resolved_company_id = companyId;
      }
    },
    resolveCompanyIdForRow: async (row: MaterializeCompanyRow) => {
      if (row.decision_type === "use_matched") {
        return { companyId: String(row.proposed_company_id), created: false };
      }
      const nameKey = row.normalized_company_name?.trim().toLowerCase() ?? row.id;
      store.createCalls.push(nameKey);
      const existing = [...store.persisted.values()].find(Boolean);
      if (store.createCalls.filter((call) => call === nameKey).length > 1) {
        const prior = store.rows.find(
          (candidate) =>
            candidate.normalized_company_name?.trim().toLowerCase() === nameKey &&
            candidate.resolved_company_id,
        );
        if (prior?.resolved_company_id) {
          return { companyId: prior.resolved_company_id, created: false };
        }
      }
      return { companyId: `company-${nameKey}`, created: true };
    },
  };
}

describe("materializeCompaniesChunkWithDeps", () => {
  it("persists resolved_company_id for each materialized row", async () => {
    const store: TestStore = {
      rows: [makeRow({ id: "row-1", excel_row_number: 10 })],
      persisted: new Map(),
      createCalls: [],
    };

    const result = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: 0, limit: 50 },
      createTestDeps(store),
    );

    assert.equal(result.materialized_count, 1);
    assert.equal(store.persisted.get("row-1"), "company-acme corp");
    assert.equal(store.rows[0]?.resolved_company_id, "company-acme corp");
  });

  it("skips rows that already have resolved_company_id on retry", async () => {
    const store: TestStore = {
      rows: [
        makeRow({ id: "row-1", excel_row_number: 10, resolved_company_id: "existing-co" }),
        makeRow({ id: "row-2", excel_row_number: 20 }),
      ],
      persisted: new Map(),
      createCalls: [],
    };

    const result = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: 0, limit: 50 },
      createTestDeps(store),
    );

    assert.equal(result.examined_count, 1);
    assert.equal(result.skipped_count, 0);
    assert.equal(result.materialized_count, 1);
    assert.equal(store.persisted.get("row-1"), undefined);
    assert.equal(store.persisted.get("row-2"), "company-acme corp");
  });

  it("can resume after partial failure", async () => {
    const store: TestStore = {
      rows: [
        makeRow({ id: "row-1", excel_row_number: 10 }),
        makeRow({ id: "row-2", excel_row_number: 20, normalized_company_name: "Beta Inc" }),
      ],
      persisted: new Map([["row-1", "company-acme corp"]]),
      createCalls: [],
    };
    store.rows[0]!.resolved_company_id = "company-acme corp";

    const deps = createTestDeps(store);
    const failOnRowTwo = {
      ...deps,
      persistRowCompanyId: async (rowId: string, companyId: string) => {
        if (rowId === "row-2") {
          throw new Error("simulated persist failure");
        }
        await deps.persistRowCompanyId(rowId, companyId);
      },
    };

    await assert.rejects(
      () => materializeCompaniesChunkWithDeps(BATCH_ID, { cursor: 0, limit: 1 }, failOnRowTwo),
      /simulated persist failure/,
    );

    const resume = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: 10, limit: 50 },
      deps,
    );

    assert.equal(resume.materialized_count, 1);
    assert.equal(store.persisted.get("row-2"), "company-beta inc");
    assert.equal(resume.done, true);
  });

  it("does not duplicate create_new companies on retry within a batch", async () => {
    const store: TestStore = {
      rows: [
        makeRow({ id: "row-1", excel_row_number: 10 }),
        makeRow({ id: "row-2", excel_row_number: 20 }),
      ],
      persisted: new Map(),
      createCalls: [],
    };

    const sharedCache = new Map<string, string>();
    const deps = createTestDeps(store);
    const dedupeResolver = {
      ...deps,
      resolveCompanyIdForRow: async (row: MaterializeCompanyRow) => {
        const nameKey = row.normalized_company_name?.trim().toLowerCase() ?? row.id;
        const cached = sharedCache.get(nameKey);
        if (cached) {
          return { companyId: cached, created: false };
        }
        sharedCache.set(nameKey, `company-${nameKey}`);
        store.createCalls.push(nameKey);
        return { companyId: `company-${nameKey}`, created: true };
      },
    };

    const first = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: 0, limit: 1 },
      dedupeResolver,
    );
    const second = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: first.next_cursor ?? 0, limit: 50 },
      dedupeResolver,
    );

    assert.equal(first.companies_created, 1);
    assert.equal(second.companies_created, 0);
    assert.equal(store.createCalls.length, 1);
    assert.equal(store.persisted.get("row-1"), store.persisted.get("row-2"));
  });

  it("persists proposed company id for use_matched rows", async () => {
    const store: TestStore = {
      rows: [
        makeRow({
          id: "row-1",
          excel_row_number: 10,
          decision_type: "use_matched",
          proposed_company_id: "matched-co-99",
        }),
      ],
      persisted: new Map(),
      createCalls: [],
    };

    const result = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: 0, limit: 50 },
      createTestDeps(store),
    );

    assert.equal(result.materialized_count, 1);
    assert.equal(result.companies_created, 0);
    assert.equal(store.persisted.get("row-1"), "matched-co-99");
  });

  it("sets done when all resolved rows have company ids", async () => {
    const store: TestStore = {
      rows: [makeRow({ id: "row-1", excel_row_number: 10 })],
      persisted: new Map(),
      createCalls: [],
    };

    const result = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: 0, limit: 50 },
      createTestDeps(store),
    );

    assert.equal(result.done, true);
    assert.equal(result.next_cursor, null);
    assert.equal(result.rows_with_company_id, 1);
    assert.equal(result.total_resolved_rows, 1);
  });

  it("paginates with cursor by excel_row_number", async () => {
    const store: TestStore = {
      rows: [
        makeRow({ id: "row-1", excel_row_number: 10, normalized_company_name: "One" }),
        makeRow({ id: "row-2", excel_row_number: 20, normalized_company_name: "Two" }),
        makeRow({ id: "row-3", excel_row_number: 30, normalized_company_name: "Three" }),
      ],
      persisted: new Map(),
      createCalls: [],
    };

    const first = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: 0, limit: 2 },
      createTestDeps(store),
    );

    assert.equal(first.examined_count, 2);
    assert.equal(first.materialized_count, 2);
    assert.equal(first.done, false);
    assert.equal(first.next_cursor, 20);

    const second = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: first.next_cursor ?? 0, limit: 2 },
      createTestDeps(store),
    );

    assert.equal(second.examined_count, 1);
    assert.equal(second.materialized_count, 1);
    assert.equal(second.done, true);
    assert.equal(second.next_cursor, null);
    assert.equal(store.persisted.size, 3);
  });
});
