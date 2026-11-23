import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MATERIALIZE_COMPANIES_DEFAULT_CHUNK,
  MATERIALIZE_COMPANIES_MAX_CHUNK,
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

describe("materializeCompaniesChunkWithDeps — Review decisions racing the chunk", () => {
  type RacingRow = MaterializeCompanyRow & { status: string };

  /**
   * Rows whose company write mirrors `.eq("status", "resolved").is("resolved_company_id", null)`;
   * `duringResolve` runs while the chunk is creating the row's company, as a Review save would.
   */
  function racingDeps(rows: RacingRow[], duringResolve: (row: RacingRow) => void) {
    const created: string[] = [];
    return {
      created,
      deps: {
        fetchPendingRows: async () =>
          rows.filter((row) => row.status === "resolved" && row.resolved_company_id === null).map((row) => ({ ...row })),
        countProgress: async () => {
          const resolved = rows.filter((row) => row.status === "resolved");
          return {
            total_resolved_rows: resolved.length,
            rows_with_company_id: resolved.filter((row) => row.resolved_company_id !== null).length,
          };
        },
        persistRowCompanyId: async (rowId: string, companyId: string) => {
          const row = rows.find((candidate) => candidate.id === rowId);
          if (!row || row.status !== "resolved" || row.resolved_company_id !== null) return false;
          row.resolved_company_id = companyId;
          return true;
        },
        resolveCompanyIdForRow: async (row: MaterializeCompanyRow) => {
          duringResolve(rows.find((candidate) => candidate.id === row.id)!);
          created.push(row.id);
          return { companyId: `company-new-${row.id}`, created: true };
        },
      },
    };
  }

  it("a row switched to another company mid-chunk keeps the reviewer's company", async () => {
    const rows: RacingRow[] = [
      { ...makeRow({ id: "row-1", excel_row_number: 10 }), status: "resolved" },
      { ...makeRow({ id: "row-2", excel_row_number: 20 }), status: "resolved" },
    ];
    const { deps } = racingDeps(rows, (row) => {
      if (row.id === "row-1") {
        row.decision_type = "choose_different";
        row.resolved_company_id = "company-chosen";
      }
    });

    const result = await materializeCompaniesChunkWithDeps(BATCH_ID, { cursor: 0, limit: 50 }, deps);

    assert.equal(rows[0]?.resolved_company_id, "company-chosen", "the Review decision is not overwritten");
    assert.equal(rows[1]?.resolved_company_id, "company-new-row-2", "other rows still materialize");
    assert.equal(result.conflict_count, 1);
    assert.equal(result.materialized_count, 1);
    assert.equal(result.done, true);
  });

  it("a row excluded mid-chunk stays excluded with no company", async () => {
    const rows: RacingRow[] = [{ ...makeRow({ id: "row-1", excel_row_number: 10 }), status: "resolved" }];
    const { deps } = racingDeps(rows, (row) => {
      row.status = "excluded";
    });

    const result = await materializeCompaniesChunkWithDeps(BATCH_ID, { cursor: 0, limit: 50 }, deps);

    assert.equal(rows[0]?.status, "excluded");
    assert.equal(rows[0]?.resolved_company_id, null);
    assert.equal(result.conflict_count, 1);
    assert.equal(result.materialized_count, 0);
  });

  it("callers that persist unconditionally are unaffected", async () => {
    const store: TestStore = { rows: [makeRow({ id: "row-1", excel_row_number: 10 })], persisted: new Map(), createCalls: [] };

    const result = await materializeCompaniesChunkWithDeps(BATCH_ID, { cursor: 0, limit: 50 }, createTestDeps(store));

    assert.equal(result.materialized_count, 1);
    assert.equal(result.conflict_count, 0);
  });
});

function makeCreateNewRows(count: number): MaterializeCompanyRow[] {
  return Array.from({ length: count }, (_, index) =>
    makeRow({
      id: `row-${index + 1}`,
      excel_row_number: index + 1,
      normalized_company_name: `Company ${index + 1}`,
      normalized_website: `https://company-${index + 1}.example`,
      proposed_slug: `company-${index + 1}`,
    }),
  );
}

/**
 * Remembers a company by name the way production does before insert, so a retry of a
 * name that was already created returns that company instead of creating another.
 */
function rememberingCreateDeps(store: TestStore) {
  const companiesByName = new Map<string, string>();
  const deps = createTestDeps(store);
  return {
    ...deps,
    resolveCompanyIdForRow: async (row: MaterializeCompanyRow) => {
      const nameKey = row.normalized_company_name?.trim().toLowerCase() ?? row.id;
      const existing = companiesByName.get(nameKey);
      if (existing) {
        return { companyId: existing, created: false };
      }
      const companyId = `company-${nameKey}`;
      companiesByName.set(nameKey, companyId);
      store.createCalls.push(nameKey);
      return { companyId, created: true };
    },
  };
}

describe("materializeCompaniesChunkWithDeps — 15-company chunks", () => {
  it("processes 15 companies when no limit is given", async () => {
    const store: TestStore = {
      rows: makeCreateNewRows(20),
      persisted: new Map(),
      createCalls: [],
    };
    const requestedLimits: number[] = [];
    const deps = rememberingCreateDeps(store);
    const result = await materializeCompaniesChunkWithDeps(BATCH_ID, {}, {
      ...deps,
      fetchPendingRows: async (batchId, cursor, limit) => {
        requestedLimits.push(limit);
        return deps.fetchPendingRows(batchId, cursor, limit);
      },
    });

    assert.equal(MATERIALIZE_COMPANIES_DEFAULT_CHUNK, 15);
    assert.deepEqual(requestedLimits, [15]);
    assert.equal(result.examined_count, 15);
    assert.equal(result.companies_created, 15);
    assert.equal(result.done, false);
    assert.equal(result.next_cursor, 15);
  });

  it("caps a larger requested limit at 20", async () => {
    const store: TestStore = {
      rows: makeCreateNewRows(25),
      persisted: new Map(),
      createCalls: [],
    };
    const requestedLimits: number[] = [];
    const deps = rememberingCreateDeps(store);
    const result = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { limit: 100 },
      {
        ...deps,
        fetchPendingRows: async (batchId, cursor, limit) => {
          requestedLimits.push(limit);
          return deps.fetchPendingRows(batchId, cursor, limit);
        },
      },
    );

    assert.equal(MATERIALIZE_COMPANIES_MAX_CHUNK, 20);
    assert.deepEqual(requestedLimits, [20]);
    assert.equal(result.examined_count, 20);
    assert.equal(result.done, false);
  });

  it("retries a partial chunk without creating a duplicate company", async () => {
    const store: TestStore = {
      rows: makeCreateNewRows(16),
      persisted: new Map(),
      createCalls: [],
    };
    const deps = rememberingCreateDeps(store);
    let failRow8 = true;
    const flaky = {
      ...deps,
      persistRowCompanyId: async (rowId: string, companyId: string) => {
        if (failRow8 && rowId === "row-8") {
          failRow8 = false;
          throw new Error("simulated persist failure");
        }
        await deps.persistRowCompanyId(rowId, companyId);
      },
    };

    await assert.rejects(
      () => materializeCompaniesChunkWithDeps(BATCH_ID, {}, flaky),
      /simulated persist failure/,
    );

    assert.equal(store.persisted.size, 7);
    assert.equal(store.createCalls.length, 8);
    assert.equal(store.rows[7]?.resolved_company_id, null);

    const resume = await materializeCompaniesChunkWithDeps(BATCH_ID, { cursor: 0 }, flaky);

    assert.equal(store.createCalls.filter((name) => name === "company 8").length, 1);
    assert.equal(store.persisted.get("row-8"), "company-company 8");
    assert.equal(store.createCalls.length, 16);
    assert.equal(resume.companies_created, 8);
    assert.equal(resume.materialized_count, 9);
    assert.equal(resume.done, true);
    assert.equal(resume.next_cursor, null);
  });

  it("a retry from the start skips companies the previous request already created", async () => {
    const store: TestStore = {
      rows: makeCreateNewRows(18),
      persisted: new Map(),
      createCalls: [],
    };
    const deps = rememberingCreateDeps(store);

    const first = await materializeCompaniesChunkWithDeps(BATCH_ID, {}, deps);
    assert.equal(first.examined_count, 15);
    assert.equal(first.done, false);
    assert.equal(store.createCalls.length, 15);

    const retry = await materializeCompaniesChunkWithDeps(BATCH_ID, { cursor: 0 }, deps);

    assert.equal(retry.examined_count, 3);
    assert.equal(retry.companies_created, 3);
    assert.equal(store.createCalls.length, 18);
    assert.equal(retry.done, true);
    assert.equal(store.persisted.size, 18);
  });

  it("finishes the import when fewer than 15 rows remain", async () => {
    const store: TestStore = {
      rows: makeCreateNewRows(18),
      persisted: new Map(),
      createCalls: [],
    };
    const deps = rememberingCreateDeps(store);

    const first = await materializeCompaniesChunkWithDeps(BATCH_ID, {}, deps);
    assert.equal(first.examined_count, 15);
    assert.equal(first.next_cursor, 15);
    assert.equal(first.done, false);

    const last = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      { cursor: first.next_cursor ?? 0 },
      deps,
    );

    assert.equal(last.examined_count, 3);
    assert.equal(last.companies_created, 3);
    assert.equal(last.done, true);
    assert.equal(last.next_cursor, null);
    assert.equal(store.persisted.size, 18);
  });

  it("completes in one request when the whole batch is smaller than 15", async () => {
    const store: TestStore = {
      rows: makeCreateNewRows(10),
      persisted: new Map(),
      createCalls: [],
    };

    const result = await materializeCompaniesChunkWithDeps(
      BATCH_ID,
      {},
      rememberingCreateDeps(store),
    );

    assert.equal(result.examined_count, 10);
    assert.equal(result.companies_created, 10);
    assert.equal(result.done, true);
    assert.equal(result.next_cursor, null);
  });
});
