import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  companyWebsiteIdentityPatch,
  updateCompanyAdminWithClient,
  type CompanyAdminRow,
} from "./companyAdmin";

const NCUE_ID = "c785f33d-3a49-42cd-a97e-df1dec555ea4";
const FACEBOOK_WEBSITE =
  "https://www.facebook.com/profile.php?id=100068135449341";
const FACEBOOK_IDENTITY = "facebook.com/profile.php?id=100068135449341";

function baseCompany(overrides: Partial<CompanyAdminRow> = {}): CompanyAdminRow {
  return {
    id: NCUE_ID,
    name: "NCUE Blockchain",
    slug: "ncue-blockchain",
    domain: null,
    website: FACEBOOK_WEBSITE,
    logo_url: null,
    logo_source: null,
    logo_status: null,
    logo_fetched_at: null,
    logo_fetch_error: null,
    city_id: null,
    created_at: null,
    aliases: [],
    status: "active",
    merged_into_company_id: null,
    merged_at: null,
    restricted_at: null,
    ...overrides,
  };
}

type MockState = {
  company: CompanyAdminRow;
  companyDomains: Array<{
    id: string;
    company_id: string;
    domain: string;
    is_primary: boolean;
  }>;
};

function createUpdateMock(state: MockState) {
  return {
    from(table: string) {
      if (table === "companies") {
        return {
          update(payload: Record<string, unknown>) {
            return {
              eq(column: string, value: string) {
                assert.equal(column, "id");
                assert.equal(value, state.company.id);
                Object.assign(state.company, payload);
                return {
                  select(_cols: string) {
                    return {
                      async single() {
                        return { data: { ...state.company }, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "company_domains") {
        return {
          select(_cols: string) {
            return {
              eq(column: string, value: string) {
                if (column === "company_id") {
                  return Promise.resolve({
                    data: state.companyDomains
                      .filter((row) => row.company_id === value)
                      .map((row) => ({
                        id: row.id,
                        domain: row.domain,
                        is_primary: row.is_primary,
                      })),
                    error: null,
                  });
                }
                if (column === "domain") {
                  return {
                    neq(_col: string, companyId: string) {
                      return Promise.resolve({
                        data: state.companyDomains
                          .filter(
                            (row) =>
                              row.domain.toLowerCase() === value.toLowerCase() &&
                              row.company_id !== companyId,
                          )
                          .map((row) => ({ company_id: row.company_id })),
                        error: null,
                      });
                    },
                  };
                }
                throw new Error(`Unexpected company_domains select eq: ${column}`);
              },
            };
          },
          update(payload: { is_primary: boolean }) {
            return {
              eq(column: string, value: string) {
                if (column === "company_id") {
                  return {
                    eq(column2: string, value2: string | boolean) {
                      if (column2 === "is_primary" && value2 === true) {
                        for (const row of state.companyDomains) {
                          if (row.company_id === value && row.is_primary) {
                            row.is_primary = payload.is_primary;
                          }
                        }
                        return Promise.resolve({ error: null });
                      }
                      throw new Error(`Unexpected update filter ${column2}`);
                    },
                  };
                }
                if (column === "id") {
                  return {
                    eq(column2: string, companyId: string) {
                      assert.equal(column2, "company_id");
                      const row = state.companyDomains.find((r) => r.id === value);
                      if (row && row.company_id === companyId) {
                        row.is_primary = payload.is_primary;
                      }
                      return Promise.resolve({ error: null });
                    },
                  };
                }
                throw new Error(`Unexpected update eq: ${column}`);
              },
            };
          },
          insert(payload: {
            company_id: string;
            domain: string;
            is_primary: boolean;
          }) {
            state.companyDomains.push({
              id: `new-${state.companyDomains.length + 1}`,
              company_id: payload.company_id,
              domain: payload.domain,
              is_primary: payload.is_primary,
            });
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("companyWebsiteIdentityPatch", () => {
  it("preserves the full Facebook website and derives the profile identity key", () => {
    assert.deepEqual(companyWebsiteIdentityPatch(FACEBOOK_WEBSITE), {
      website: FACEBOOK_WEBSITE,
      domain: FACEBOOK_IDENTITY,
    });
  });
});

describe("updateCompanyAdminWithClient website identity repair", () => {
  it("repairs null domain and creates primary company_domains on unchanged website save", async () => {
    const state: MockState = {
      company: baseCompany({ domain: null, website: FACEBOOK_WEBSITE }),
      companyDomains: [],
    };

    const result = await updateCompanyAdminWithClient(
      createUpdateMock(state) as never,
      NCUE_ID,
      { website: FACEBOOK_WEBSITE },
      state.company,
    );

    assert.equal(result.company.website, FACEBOOK_WEBSITE);
    assert.equal(result.company.domain, FACEBOOK_IDENTITY);
    assert.equal(state.company.website, FACEBOOK_WEBSITE);
    assert.equal(state.company.domain, FACEBOOK_IDENTITY);
    assert.equal(state.companyDomains.length, 1);
    assert.equal(state.companyDomains[0]?.domain, FACEBOOK_IDENTITY);
    assert.equal(state.companyDomains[0]?.is_primary, true);
  });

  it("is idempotent on a second unchanged website save", async () => {
    const state: MockState = {
      company: baseCompany({ domain: null, website: FACEBOOK_WEBSITE }),
      companyDomains: [],
    };
    const client = createUpdateMock(state) as never;

    await updateCompanyAdminWithClient(
      client,
      NCUE_ID,
      { website: FACEBOOK_WEBSITE },
      state.company,
    );
    await updateCompanyAdminWithClient(
      client,
      NCUE_ID,
      { website: FACEBOOK_WEBSITE },
      state.company,
    );

    assert.equal(state.company.website, FACEBOOK_WEBSITE);
    assert.equal(state.company.domain, FACEBOOK_IDENTITY);
    assert.equal(state.companyDomains.length, 1);
    assert.equal(state.companyDomains[0]?.domain, FACEBOOK_IDENTITY);
    assert.equal(state.companyDomains[0]?.is_primary, true);
  });

  it("preserves existing alias rows when repairing primary identity", async () => {
    const state: MockState = {
      company: baseCompany({ domain: null, website: FACEBOOK_WEBSITE }),
      companyDomains: [
        {
          id: "alias-1",
          company_id: NCUE_ID,
          domain: "ncue.edu.tw",
          is_primary: false,
        },
      ],
    };

    await updateCompanyAdminWithClient(
      createUpdateMock(state) as never,
      NCUE_ID,
      { website: FACEBOOK_WEBSITE },
      state.company,
    );

    assert.equal(state.companyDomains.length, 2);
    const alias = state.companyDomains.find((row) => row.domain === "ncue.edu.tw");
    const primary = state.companyDomains.find((row) => row.is_primary);
    assert.equal(alias?.is_primary, false);
    assert.equal(primary?.domain, FACEBOOK_IDENTITY);
  });
});
