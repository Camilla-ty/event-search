import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CompanyRelatedAdminError,
  normalizeRelatedCompanyPair,
} from "./companyRelatedAdmin";

const ID_A = "00000000-0000-4000-8000-00000000000a";
const ID_B = "00000000-0000-4000-8000-00000000000b";

describe("normalizeRelatedCompanyPair", () => {
  it("orders ids so company_a_id < company_b_id", () => {
    assert.deepEqual(normalizeRelatedCompanyPair(ID_B, ID_A), {
      company_a_id: ID_A,
      company_b_id: ID_B,
    });
    assert.deepEqual(normalizeRelatedCompanyPair(ID_A, ID_B), {
      company_a_id: ID_A,
      company_b_id: ID_B,
    });
  });

  it("rejects self links", () => {
    assert.throws(
      () => normalizeRelatedCompanyPair(ID_A, ID_A),
      (error: unknown) =>
        error instanceof CompanyRelatedAdminError &&
        error.status === 400 &&
        error.message.includes("itself"),
    );
  });
});
