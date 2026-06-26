import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CompanyDomainLinkError,
  ensureCompanyDomainFromImportLink,
  normalizeVerifiedCompanyDomainInput,
  planCompanyDomainLink,
  verifiedCompanyDomainInputErrorMessage,
} from "./linkCompanyDomainFromImport";

const BITLIFI_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";

describe("normalizeVerifiedCompanyDomainInput", () => {
  it("normalizes a bare hostname", () => {
    const result = normalizeVerifiedCompanyDomainInput("bitlifi.jp");
    assert.deepEqual(result, { ok: true, domain: "bitlifi.jp" });
  });

  it("normalizes a full website URL", () => {
    const result = normalizeVerifiedCompanyDomainInput("https://www.bitlifi.jp/about");
    assert.deepEqual(result, { ok: true, domain: "bitlifi.jp" });
  });

  it("rejects community and social URLs", () => {
    const result = normalizeVerifiedCompanyDomainInput("https://instagram.com/brandb");
    assert.deepEqual(result, { ok: false, reason: "no_identity" });
    assert.equal(
      verifiedCompanyDomainInputErrorMessage("no_identity"),
      "Community and social URLs cannot be stored as company domains.",
    );
  });

  it("rejects blank input", () => {
    assert.deepEqual(normalizeVerifiedCompanyDomainInput(""), { ok: false, reason: "blank" });
    assert.deepEqual(normalizeVerifiedCompanyDomainInput("   "), { ok: false, reason: "blank" });
  });
});

describe("planCompanyDomainLink", () => {
  it("inserts a non-primary domain when import domain differs from companies.domain", () => {
    const plan = planCompanyDomainLink({
      normalizedImportDomain: "bitlifi.jp",
      companyPrimaryDomain: "bitlifi.com",
      targetCompanyId: BITLIFI_ID,
      existingCompanyDomainOwners: [],
      otherCompanyPrimaryDomainOwners: [],
    });

    assert.deepEqual(plan, {
      action: "insert",
      domain: "bitlifi.jp",
      companyId: BITLIFI_ID,
    });
  });

  it("skips when import domain matches the company primary domain", () => {
    const plan = planCompanyDomainLink({
      normalizedImportDomain: "bitlifi.com",
      companyPrimaryDomain: "bitlifi.com",
      targetCompanyId: BITLIFI_ID,
      existingCompanyDomainOwners: [],
      otherCompanyPrimaryDomainOwners: [],
    });

    assert.deepEqual(plan, { action: "skip", reason: "same_as_primary" });
  });

  it("is a no-op when the domain is already linked to the same company", () => {
    const plan = planCompanyDomainLink({
      normalizedImportDomain: "bitlifi.jp",
      companyPrimaryDomain: "bitlifi.com",
      targetCompanyId: BITLIFI_ID,
      existingCompanyDomainOwners: [{ company_id: BITLIFI_ID, domain: "bitlifi.jp" }],
      otherCompanyPrimaryDomainOwners: [],
    });

    assert.deepEqual(plan, { action: "noop", reason: "already_linked" });
  });

  it("conflicts when company_domains already maps the domain to another company", () => {
    const plan = planCompanyDomainLink({
      normalizedImportDomain: "bitlifi.jp",
      companyPrimaryDomain: "bitlifi.com",
      targetCompanyId: BITLIFI_ID,
      existingCompanyDomainOwners: [{ company_id: OTHER_ID, domain: "bitlifi.jp" }],
      otherCompanyPrimaryDomainOwners: [],
    });

    assert.deepEqual(plan, {
      action: "conflict",
      domain: "bitlifi.jp",
      ownerCompanyId: OTHER_ID,
    });
  });

  it("conflicts when another company owns the domain as companies.domain", () => {
    const plan = planCompanyDomainLink({
      normalizedImportDomain: "bitlifi.jp",
      companyPrimaryDomain: "bitlifi.com",
      targetCompanyId: BITLIFI_ID,
      existingCompanyDomainOwners: [],
      otherCompanyPrimaryDomainOwners: [{ id: OTHER_ID, domain: "bitlifi.jp" }],
    });

    assert.deepEqual(plan, {
      action: "conflict",
      domain: "bitlifi.jp",
      ownerCompanyId: OTHER_ID,
    });
  });

  it("skips rows with no valid identity domain", () => {
    const plan = planCompanyDomainLink({
      normalizedImportDomain: null,
      companyPrimaryDomain: "bitlifi.com",
      targetCompanyId: BITLIFI_ID,
      existingCompanyDomainOwners: [],
      otherCompanyPrimaryDomainOwners: [],
    });

    assert.deepEqual(plan, { action: "skip", reason: "no_domain" });
  });
});

type MockState = {
  companies: Array<{ id: string; domain: string | null; website?: string | null }>;
  companyDomains: Array<{ company_id: string; domain: string; is_primary: boolean }>;
};

function createMockSupabase(state: MockState) {
  return {
    from(table: string) {
      const api = {
        select() {
          return api;
        },
        eq(column: string, value: string) {
          if (table === "companies" && column === "id") {
            const company = state.companies.find((row) => row.id === value) ?? null;
            return {
              maybeSingle: async () => ({ data: company, error: null }),
            };
          }
          if (table === "company_domains" && column === "domain") {
            return {
              async then(resolve: (value: unknown) => void) {
                resolve({
                  data: state.companyDomains.filter((row) => row.domain === value),
                  error: null,
                });
              },
            };
          }
          if (table === "companies" && column === "domain") {
            const chain = {
              neq(otherColumn: string, otherValue: string) {
                assert.equal(otherColumn, "id");
                return {
                  async then(resolve: (value: unknown) => void) {
                    resolve({
                      data: state.companies.filter(
                        (row) => row.domain === value && row.id !== otherValue,
                      ),
                      error: null,
                    });
                  },
                };
              },
            };
            return chain;
          }
          throw new Error(`Unexpected eq: ${table}.${column}`);
        },
        neq() {
          return this;
        },
        insert(payload: { company_id: string; domain: string; is_primary: boolean }) {
          const conflict = state.companyDomains.find((row) => row.domain === payload.domain);
          if (conflict && conflict.company_id !== payload.company_id) {
            return {
              async then(resolve: (value: unknown) => void) {
                resolve({
                  error: { message: "duplicate key value violates unique constraint company_domains_domain_uidx" },
                });
              },
            };
          }
          if (!conflict) {
            state.companyDomains.push({ ...payload });
          }
          return {
            async then(resolve: (value: unknown) => void) {
              resolve({ error: null });
            },
          };
        },
      };
      return api;
    },
  };
}

describe("ensureCompanyDomainFromImportLink", () => {
  it("creates company_domains with is_primary=false without changing companies fields", async () => {
    const state: MockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "bitlifi.com",
          website: "https://bitlifi.com",
        },
      ],
      companyDomains: [],
    };
    const supabase = createMockSupabase(state);

    const result = await ensureCompanyDomainFromImportLink(supabase as never, {
      companyId: BITLIFI_ID,
      normalizedImportDomain: "bitlifi.jp",
    });

    assert.deepEqual(result, {
      action: "insert",
      domain: "bitlifi.jp",
      companyId: BITLIFI_ID,
    });
    assert.deepEqual(state.companyDomains, [
      { company_id: BITLIFI_ID, domain: "bitlifi.jp", is_primary: false },
    ]);
    assert.equal(state.companies[0]?.domain, "bitlifi.com");
    assert.equal(state.companies[0]?.website, "https://bitlifi.com");
  });

  it("is idempotent when the same domain is linked again", async () => {
    const state: MockState = {
      companies: [{ id: BITLIFI_ID, domain: "bitlifi.com" }],
      companyDomains: [{ company_id: BITLIFI_ID, domain: "bitlifi.jp", is_primary: false }],
    };
    const supabase = createMockSupabase(state);

    const result = await ensureCompanyDomainFromImportLink(supabase as never, {
      companyId: BITLIFI_ID,
      normalizedImportDomain: "bitlifi.jp",
    });

    assert.deepEqual(result, { action: "noop", reason: "already_linked" });
    assert.equal(state.companyDomains.length, 1);
  });

  it("throws when another company already owns the domain", async () => {
    const state: MockState = {
      companies: [
        { id: BITLIFI_ID, domain: "bitlifi.com" },
        { id: OTHER_ID, domain: "bitlifi.jp" },
      ],
      companyDomains: [],
    };
    const supabase = createMockSupabase(state);

    await assert.rejects(
      () =>
        ensureCompanyDomainFromImportLink(supabase as never, {
          companyId: BITLIFI_ID,
          normalizedImportDomain: "bitlifi.jp",
        }),
      (error: unknown) => {
        assert.ok(error instanceof CompanyDomainLinkError);
        assert.equal(error.status, 409);
        return true;
      },
    );
    assert.equal(state.companyDomains.length, 0);
  });

  it("does not create company_domains when normalized import domain is null", async () => {
    const state: MockState = {
      companies: [{ id: BITLIFI_ID, domain: "bitlifi.com" }],
      companyDomains: [],
    };
    const supabase = createMockSupabase(state);

    const result = await ensureCompanyDomainFromImportLink(supabase as never, {
      companyId: BITLIFI_ID,
      normalizedImportDomain: null,
    });

    assert.deepEqual(result, { action: "skip", reason: "no_domain" });
    assert.equal(state.companyDomains.length, 0);
  });
});
