import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CompanyDomainLinkError } from "@/src/lib/companies/linkCompanyDomainFromImport";

import {
  addCompanyDomainWithClient,
  CompanyDomainAdminError,
  parseSetCompanyPrimaryDomainRpcError,
  setCompanyPrimaryDomainWithClient,
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

const PRIMARY_ROW_ID = "22222222-2222-4222-8222-222222222222";
const ADDITIONAL_ROW_ID = "33333333-3333-4333-8333-333333333333";

type SetPrimaryMockCompany = {
  id: string;
  domain: string | null;
  website: string | null;
  status?: string;
  merged_into_company_id?: string | null;
};

type SetPrimaryMockDomainRow = {
  id: string;
  company_id: string;
  domain: string;
  is_primary: boolean;
};

type SetPrimaryMockState = {
  companies: SetPrimaryMockCompany[];
  companyDomains: SetPrimaryMockDomainRow[];
  rpcFailAfterCompanyUpdate?: boolean;
};

function simulateSetCompanyPrimaryDomainRpc(
  state: SetPrimaryMockState,
  companyId: string,
  domainRowId: string,
  website?: string | null,
) {
  const company = state.companies.find((row) => row.id === companyId);
  if (!company) {
    return { data: null, error: { message: "company_not_found" } };
  }

  if (company.status === "merged" || company.merged_into_company_id) {
    return { data: null, error: { message: "merged_read_only" } };
  }

  const domainRow = state.companyDomains.find(
    (row) => row.id === domainRowId && row.company_id === companyId,
  );
  if (!domainRow) {
    return { data: null, error: { message: "domain_not_found" } };
  }

  const newDomain = domainRow.domain.trim();
  let newWebsite = (website ?? "").trim();
  if (newWebsite === "") {
    newWebsite = `https://${newDomain}`;
  } else if (!/^https?:\/\//i.test(newWebsite)) {
    newWebsite = `https://${newWebsite}`;
  }
  if (newWebsite.toLowerCase() === newDomain.toLowerCase()) {
    newWebsite = `https://${newDomain}`;
  }

  if (domainRow.is_primary) {
    company.domain = newDomain;
    company.website = newWebsite;
    return {
      data: {
        status: "already_primary",
        company_id: companyId,
        website: company.website,
        domain: company.domain,
        primary_domain_id: domainRowId,
      },
      error: null,
    };
  }

  const snapshot = structuredClone(state);

  try {
    company.website = newWebsite;
    company.domain = newDomain;

    if (state.rpcFailAfterCompanyUpdate) {
      throw new Error("simulated_domain_update_failure");
    }

    for (const row of state.companyDomains) {
      if (row.company_id === companyId) {
        row.is_primary = row.id === domainRowId;
      }
    }

    return {
      data: {
        status: "updated",
        company_id: companyId,
        website: newWebsite,
        domain: newDomain,
        primary_domain_id: domainRowId,
      },
      error: null,
    };
  } catch (error) {
    state.companies = snapshot.companies;
    state.companyDomains = snapshot.companyDomains;
    const message = error instanceof Error ? error.message : "rpc_failed";
    return { data: null, error: { message } };
  }
}

function createSetPrimaryMockSupabase(state: SetPrimaryMockState) {
  return {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(column: string, value: string) {
              if (table === "company_domains" && column === "id") {
                return {
                  eq(column2: string, value2: string) {
                    return {
                      async maybeSingle() {
                        const row = state.companyDomains.find(
                          (d) => d.id === value && d.company_id === value2,
                        );
                        return {
                          data: row
                            ? { id: row.id, domain: row.domain }
                            : null,
                          error: null,
                        };
                      },
                    };
                  },
                };
              }
              if (table === "companies" && column === "id") {
                return {
                  async maybeSingle() {
                    const row = state.companies.find((c) => c.id === value);
                    return {
                      data: row ? { website: row.website } : null,
                      error: null,
                    };
                  },
                };
              }
              throw new Error(`Unexpected from/eq: ${table}.${column}`);
            },
          };
        },
      };
    },
    rpc(
      name: string,
      args: {
        p_company_id: string;
        p_company_domain_id: string;
        p_website?: string | null;
      },
    ) {
      if (name !== "set_company_primary_domain") {
        throw new Error(`Unexpected rpc: ${name}`);
      }
      return simulateSetCompanyPrimaryDomainRpc(
        state,
        args.p_company_id,
        args.p_company_domain_id,
        args.p_website,
      );
    },
  };
}

describe("setCompanyPrimaryDomainWithClient", () => {
  it("updates companies.website and companies.domain when promoting an additional domain", async () => {
    const state: SetPrimaryMockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "studentsforlibertycz.cz",
          website: "https://studentsforlibertycz.cz",
        },
      ],
      companyDomains: [
        {
          id: PRIMARY_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "studentsforlibertycz.cz",
          is_primary: true,
        },
        {
          id: ADDITIONAL_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "studentsforliberty.org",
          is_primary: false,
        },
      ],
    };

    const result = await setCompanyPrimaryDomainWithClient(
      createSetPrimaryMockSupabase(state) as never,
      BITLIFI_ID,
      ADDITIONAL_ROW_ID,
    );

    assert.equal(result.status, "updated");
    assert.equal(state.companies[0]?.website, "https://studentsforliberty.org");
    assert.equal(state.companies[0]?.domain, "studentsforliberty.org");
  });

  it("preserves a full Primary website URL when it already matches the promoted identity", async () => {
    const fullUrl =
      "https://www.facebook.com/profile.php?id=100068135449341&utm_source=test";
    const state: SetPrimaryMockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "bitlifi.com",
          website: "https://bitlifi.com",
        },
      ],
      companyDomains: [
        {
          id: PRIMARY_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "bitlifi.com",
          is_primary: true,
        },
        {
          id: ADDITIONAL_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "facebook.com/profile.php?id=100068135449341",
          is_primary: false,
        },
      ],
    };

    const result = await setCompanyPrimaryDomainWithClient(
      createSetPrimaryMockSupabase(state) as never,
      BITLIFI_ID,
      ADDITIONAL_ROW_ID,
      { currentWebsite: fullUrl },
    );

    assert.equal(result.status, "updated");
    assert.equal(state.companies[0]?.website, fullUrl);
    assert.equal(
      state.companies[0]?.domain,
      "facebook.com/profile.php?id=100068135449341",
    );
  });

  it("does not store the raw match key as companies.website when promoting", async () => {
    const state: SetPrimaryMockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "studentsforlibertycz.cz",
          website: "https://studentsforlibertycz.cz",
        },
      ],
      companyDomains: [
        {
          id: PRIMARY_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "studentsforlibertycz.cz",
          is_primary: true,
        },
        {
          id: ADDITIONAL_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "studentsforliberty.org",
          is_primary: false,
        },
      ],
    };

    await setCompanyPrimaryDomainWithClient(
      createSetPrimaryMockSupabase(state) as never,
      BITLIFI_ID,
      ADDITIONAL_ROW_ID,
    );

    assert.notEqual(state.companies[0]?.website, "studentsforliberty.org");
    assert.equal(state.companies[0]?.website, "https://studentsforliberty.org");
  });

  it("demotes the old primary and promotes the selected domain row", async () => {
    const state: SetPrimaryMockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "studentsforlibertycz.cz",
          website: "studentsforlibertycz.cz",
        },
      ],
      companyDomains: [
        {
          id: PRIMARY_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "studentsforlibertycz.cz",
          is_primary: true,
        },
        {
          id: ADDITIONAL_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "studentsforliberty.org",
          is_primary: false,
        },
      ],
    };

    await setCompanyPrimaryDomainWithClient(
      createSetPrimaryMockSupabase(state) as never,
      BITLIFI_ID,
      ADDITIONAL_ROW_ID,
    );

    const primary = state.companyDomains.find((row) => row.is_primary);
    const additional = state.companyDomains.find((row) => !row.is_primary);
    assert.equal(primary?.id, ADDITIONAL_ROW_ID);
    assert.equal(primary?.domain, "studentsforliberty.org");
    assert.equal(additional?.id, PRIMARY_ROW_ID);
    assert.equal(additional?.domain, "studentsforlibertycz.cz");
  });

  it("rejects domains that do not belong to the company", async () => {
    const state: SetPrimaryMockState = {
      companies: [{ id: BITLIFI_ID, domain: "bitlifi.com", website: "bitlifi.com" }],
      companyDomains: [
        {
          id: ADDITIONAL_ROW_ID,
          company_id: OTHER_ID,
          domain: "bitlifi.jp",
          is_primary: false,
        },
      ],
    };

    await assert.rejects(
      () =>
        setCompanyPrimaryDomainWithClient(
          createSetPrimaryMockSupabase(state) as never,
          BITLIFI_ID,
          ADDITIONAL_ROW_ID,
        ),
      (error: unknown) => {
        assert.ok(error instanceof CompanyDomainAdminError);
        assert.equal(error.status, 404);
        return true;
      },
    );
    assert.equal(state.companies[0]?.domain, "bitlifi.com");
    assert.equal(state.companies[0]?.website, "bitlifi.com");
  });

  it("rejects merged or read-only companies", async () => {
    const state: SetPrimaryMockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "bitlifi.com",
          website: "bitlifi.com",
          status: "merged",
          merged_into_company_id: OTHER_ID,
        },
      ],
      companyDomains: [
        {
          id: PRIMARY_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "bitlifi.com",
          is_primary: true,
        },
        {
          id: ADDITIONAL_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "bitlifi.jp",
          is_primary: false,
        },
      ],
    };

    await assert.rejects(
      () =>
        setCompanyPrimaryDomainWithClient(
          createSetPrimaryMockSupabase(state) as never,
          BITLIFI_ID,
          ADDITIONAL_ROW_ID,
        ),
      (error: unknown) => {
        assert.ok(error instanceof CompanyDomainAdminError);
        assert.equal(error.status, 409);
        return true;
      },
    );
    assert.equal(state.companies[0]?.domain, "bitlifi.com");
    assert.equal(state.companyDomains.find((row) => row.is_primary)?.id, PRIMARY_ROW_ID);
  });

  it("does not leave companies fields changed when the RPC fails", async () => {
    const state: SetPrimaryMockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "studentsforlibertycz.cz",
          website: "studentsforlibertycz.cz",
        },
      ],
      companyDomains: [
        {
          id: PRIMARY_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "studentsforlibertycz.cz",
          is_primary: true,
        },
        {
          id: ADDITIONAL_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "studentsforliberty.org",
          is_primary: false,
        },
      ],
      rpcFailAfterCompanyUpdate: true,
    };

    await assert.rejects(
      () =>
        setCompanyPrimaryDomainWithClient(
          createSetPrimaryMockSupabase(state) as never,
          BITLIFI_ID,
          ADDITIONAL_ROW_ID,
        ),
      (error: unknown) => {
        assert.ok(error instanceof CompanyDomainAdminError);
        assert.equal(error.status, 500);
        return true;
      },
    );

    // Real Postgres RPC rolls back both writes; mock restores snapshot on failure.
    assert.equal(state.companies[0]?.domain, "studentsforlibertycz.cz");
    assert.equal(state.companies[0]?.website, "studentsforlibertycz.cz");
    assert.equal(state.companyDomains.find((row) => row.is_primary)?.id, PRIMARY_ROW_ID);
  });

  it("already_primary repairs null companies.domain from the primary row", async () => {
    const state: SetPrimaryMockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: null,
          website: "https://coinmarketcap.com/",
        },
      ],
      companyDomains: [
        {
          id: PRIMARY_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "coinmarketcap.com",
          is_primary: true,
        },
      ],
    };

    const result = await setCompanyPrimaryDomainWithClient(
      createSetPrimaryMockSupabase(state) as never,
      BITLIFI_ID,
      PRIMARY_ROW_ID,
    );

    assert.equal(result.status, "already_primary");
    assert.equal(result.domain, "coinmarketcap.com");
    assert.equal(result.website, "https://coinmarketcap.com/");
    assert.equal(state.companies[0]?.domain, "coinmarketcap.com");
    assert.equal(state.companies[0]?.website, "https://coinmarketcap.com/");
    assert.equal(state.companyDomains.find((row) => row.is_primary)?.id, PRIMARY_ROW_ID);
  });

  it("already_primary repairs mismatched companies.domain from the primary row", async () => {
    const state: SetPrimaryMockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "old.example",
          website: "https://old.example/",
        },
      ],
      companyDomains: [
        {
          id: PRIMARY_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "coingecko.com",
          is_primary: true,
        },
      ],
    };

    const result = await setCompanyPrimaryDomainWithClient(
      createSetPrimaryMockSupabase(state) as never,
      BITLIFI_ID,
      PRIMARY_ROW_ID,
    );

    assert.equal(result.status, "already_primary");
    assert.equal(state.companies[0]?.domain, "coingecko.com");
    assert.equal(state.companies[0]?.website, "https://coingecko.com");
  });

  it("already_primary upgrades a raw match-key website to an https URL", async () => {
    const state: SetPrimaryMockState = {
      companies: [
        {
          id: BITLIFI_ID,
          domain: "coinmarketcap.com",
          website: "coinmarketcap.com",
        },
      ],
      companyDomains: [
        {
          id: PRIMARY_ROW_ID,
          company_id: BITLIFI_ID,
          domain: "coinmarketcap.com",
          is_primary: true,
        },
      ],
    };

    const result = await setCompanyPrimaryDomainWithClient(
      createSetPrimaryMockSupabase(state) as never,
      BITLIFI_ID,
      PRIMARY_ROW_ID,
    );

    assert.equal(result.status, "already_primary");
    assert.equal(state.companies[0]?.website, "https://coinmarketcap.com");
    assert.equal(state.companies[0]?.domain, "coinmarketcap.com");
  });
});

describe("parseSetCompanyPrimaryDomainRpcError", () => {
  it("maps RPC failure codes to admin errors", () => {
    assert.equal(
      parseSetCompanyPrimaryDomainRpcError("company_not_found").message,
      "Company not found.",
    );
    assert.equal(
      parseSetCompanyPrimaryDomainRpcError("domain_not_found").message,
      "Domain not found for this company.",
    );
    assert.match(parseSetCompanyPrimaryDomainRpcError("merged_read_only").message, /read-only/i);
  });
});

describe("phase 9 scope isolation", () => {
  it("keeps import matching and public page modules out of company domain admin server code", async () => {
    const moduleUrl = new URL("./companyDomainsAdmin.ts", import.meta.url);
    const source = await import("node:fs/promises").then((fs) => fs.readFile(moduleUrl, "utf8"));

    assert.ok(!source.includes("companyImportMatching"));
    assert.ok(!source.includes("matchRows"));
    assert.ok(!source.includes("sponsorImportAdmin"));
    assert.ok(!source.includes("formatPublicCompanyWebsite"));
    assert.ok(!source.includes("event_sponsors"));
  });
});
