import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CompanyDomainLinkError } from "@/src/lib/companies/linkCompanyDomainFromImport";

import {
  addCompanyDomainWithClient,
  sortCompanyDomainsForDisplay,
  type CompanyDomainAdminRow,
} from "./companyDomainsAdmin";

const BITLIFI_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";

function domainRow(
  overrides: Partial<CompanyDomainAdminRow> & Pick<CompanyDomainAdminRow, "domain" | "is_primary">,
): CompanyDomainAdminRow {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000001",
    company_id: overrides.company_id ?? "00000000-0000-4000-8000-000000000099",
    created_at: overrides.created_at ?? null,
    note: overrides.note ?? null,
    domain: overrides.domain,
    is_primary: overrides.is_primary,
  };
}

describe("sortCompanyDomainsForDisplay", () => {
  it("lists primary domains first, then alphabetically", () => {
    const sorted = sortCompanyDomainsForDisplay([
      domainRow({ id: "1", domain: "bitlifi.jp", is_primary: false }),
      domainRow({ id: "2", domain: "bitlifi.com", is_primary: true }),
      domainRow({ id: "3", domain: "acme.com", is_primary: false }),
    ]);

    assert.deepEqual(
      sorted.map((item) => [item.domain, item.is_primary]),
      [
        ["bitlifi.com", true],
        ["acme.com", false],
        ["bitlifi.jp", false],
      ],
    );
  });

  it("ignores note when ordering domains", () => {
    const sorted = sortCompanyDomainsForDisplay([
      domainRow({
        id: "1",
        domain: "bitlifi.cz",
        is_primary: false,
        note: "Czech regional site",
      }),
      domainRow({ id: "2", domain: "bitlifi.com", is_primary: true, note: "Global site" }),
    ]);

    assert.equal(sorted[0]?.domain, "bitlifi.com");
    assert.equal(sorted[1]?.note, "Czech regional site");
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
            return {
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
          }
          throw new Error(`Unexpected eq: ${table}.${column}`);
        },
        insert(payload: { company_id: string; domain: string; is_primary: boolean }) {
          const conflict = state.companyDomains.find((row) => row.domain === payload.domain);
          if (conflict && conflict.company_id !== payload.company_id) {
            return {
              async then(resolve: (value: unknown) => void) {
                resolve({
                  error: {
                    message:
                      "duplicate key value violates unique constraint company_domains_domain_uidx",
                  },
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

describe("addCompanyDomainWithClient", () => {
  it("adds a valid additional domain without changing companies fields", async () => {
    const state: MockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "bitlifi.com",
          website: "https://bitlifi.com",
        },
      ],
      companyDomains: [{ company_id: BITLIFI_ID, domain: "bitlifi.com", is_primary: true }],
    };

    const result = await addCompanyDomainWithClient(
      createMockSupabase(state) as never,
      BITLIFI_ID,
      "https://bitlifi.jp",
    );

    assert.deepEqual(result, { ok: true, status: "created", domain: "bitlifi.jp" });
    assert.deepEqual(state.companyDomains, [
      { company_id: BITLIFI_ID, domain: "bitlifi.com", is_primary: true },
      { company_id: BITLIFI_ID, domain: "bitlifi.jp", is_primary: false },
    ]);
    assert.equal(state.companies[0]?.domain, "bitlifi.com");
    assert.equal(state.companies[0]?.website, "https://bitlifi.com");
  });

  it("returns a friendly message when the same company already owns the domain", async () => {
    const state: MockState = {
      companies: [{ id: BITLIFI_ID, domain: "bitlifi.com" }],
      companyDomains: [{ company_id: BITLIFI_ID, domain: "bitlifi.jp", is_primary: false }],
    };

    const result = await addCompanyDomainWithClient(
      createMockSupabase(state) as never,
      BITLIFI_ID,
      "bitlifi.jp",
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "already_linked");
    assert.equal(state.companyDomains.length, 1);
  });

  it("rejects domains owned by another company", async () => {
    const state: MockState = {
      companies: [
        { id: BITLIFI_ID, domain: "bitlifi.com" },
        { id: OTHER_ID, domain: "bitlifi.jp" },
      ],
      companyDomains: [],
    };

    await assert.rejects(
      () =>
        addCompanyDomainWithClient(createMockSupabase(state) as never, BITLIFI_ID, "bitlifi.jp"),
      (error: unknown) => {
        assert.ok(error instanceof CompanyDomainLinkError);
        assert.equal(error.status, 409);
        return true;
      },
    );
    assert.equal(state.companyDomains.length, 0);
  });

  it("rejects invalid and no-identity URLs", async () => {
    const state: MockState = {
      companies: [{ id: BITLIFI_ID, domain: "bitlifi.com" }],
      companyDomains: [],
    };
    const supabase = createMockSupabase(state) as never;

    await assert.rejects(
      () => addCompanyDomainWithClient(supabase, BITLIFI_ID, ""),
      CompanyDomainLinkError,
    );
    await assert.rejects(
      () => addCompanyDomainWithClient(supabase, BITLIFI_ID, "https://instagram.com/brandb"),
      (error: unknown) => {
        assert.ok(error instanceof CompanyDomainLinkError);
        assert.equal(error.status, 400);
        return true;
      },
    );
    assert.equal(state.companyDomains.length, 0);
  });
});
