import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSupabaseImportMatchCandidateSource } from "@/src/lib/companies/importMatchCandidateLoader";

describe("createSupabaseImportMatchCandidateSource exact key RPCs", () => {
  it("uses import_match_company_ids_by_exact_alias_keys instead of a broad alias scan", async () => {
    const rpcCalls: Array<{ name: string; args: unknown }> = [];
    const fake = {
      rpc: async (name: string, args: unknown) => {
        rpcCalls.push({ name, args });
        return { data: [{ id: "alias-co" }], error: null };
      },
      from: () => {
        throw new Error("alias lookup must not query companies.from for broad scan");
      },
    };

    const source = createSupabaseImportMatchCandidateSource(fake as never);
    const ids = await source.findActiveCompanyIdsByExactAliasKeys(["bitfarms"]);
    assert.deepEqual(ids, ["alias-co"]);
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0]?.name, "import_match_company_ids_by_exact_alias_keys");
    assert.deepEqual(rpcCalls[0]?.args, { p_keys: ["bitfarms"] });
  });

  it("uses import_match_company_ids_by_exact_name_keys for canonical names", async () => {
    const rpcCalls: Array<{ name: string; args: unknown }> = [];
    const fake = {
      rpc: async (name: string, args: unknown) => {
        rpcCalls.push({ name, args });
        return { data: [{ id: "name-co" }], error: null };
      },
      from: () => {
        throw new Error("name lookup must use exact-key RPC");
      },
    };

    const source = createSupabaseImportMatchCandidateSource(fake as never);
    const ids = await source.findActiveCompanyIdsByExactNameKeys(["keel infrastructure"]);
    assert.deepEqual(ids, ["name-co"]);
    assert.equal(rpcCalls[0]?.name, "import_match_company_ids_by_exact_name_keys");
  });
});
