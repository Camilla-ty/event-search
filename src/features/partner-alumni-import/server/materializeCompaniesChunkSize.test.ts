import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { materializeCompaniesChunkWithDeps } from "@/src/features/sponsor-import/server/materializeCompanies";

import {
  MATERIALIZE_COMPANIES_DEFAULT_CHUNK,
  MATERIALIZE_COMPANIES_MAX_CHUNK,
} from "./materializeCompanies";

describe("partner alumni company materialization chunk size", () => {
  it("shares the sponsor default of 15 and maximum of 20", async () => {
    assert.equal(MATERIALIZE_COMPANIES_DEFAULT_CHUNK, 15);
    assert.equal(MATERIALIZE_COMPANIES_MAX_CHUNK, 20);

    const requestedLimits: number[] = [];
    const deps = {
      fetchPendingRows: async (_batchId: string, _cursor: number, limit: number) => {
        requestedLimits.push(limit);
        return [];
      },
      countProgress: async () => ({ total_resolved_rows: 0, rows_with_company_id: 0 }),
      persistRowCompanyId: async () => true,
      resolveCompanyIdForRow: async () => ({ companyId: "unused", created: false }),
    };

    await materializeCompaniesChunkWithDeps("batch-1", {}, deps);
    await materializeCompaniesChunkWithDeps("batch-1", { limit: 50 }, deps);

    assert.deepEqual(requestedLimits, [15, 20]);

    const wrapper = readFileSync(new URL("./materializeCompanies.ts", import.meta.url), "utf8");
    assert.match(wrapper, /materializeCompaniesChunkWithDeps\(batchId, options,/);
  });
});
