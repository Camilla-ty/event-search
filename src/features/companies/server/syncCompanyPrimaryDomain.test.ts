import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  planSyncCompanyPrimaryDomain,
  syncCompanyPrimaryDomainWithClient,
  type CompanyDomainSyncRow,
} from "./syncCompanyPrimaryDomain";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";
const PRIMARY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ALIAS_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("planSyncCompanyPrimaryDomain", () => {
  it("noops when primary already matches companies.domain", () => {
    const rows: CompanyDomainSyncRow[] = [
      { id: PRIMARY_ID, domain: "coingecko.com", is_primary: true },
    ];
    assert.deepEqual(
      planSyncCompanyPrimaryDomain({
        desiredDomain: "coingecko.com",
        companyDomainRows: rows,
        foreignOwnersOfDesiredDomain: [],
      }),
      { action: "noop" },
    );
  });

  it("demotes primary when companies.domain is cleared", () => {
    assert.deepEqual(
      planSyncCompanyPrimaryDomain({
        desiredDomain: null,
        companyDomainRows: [
          { id: PRIMARY_ID, domain: "coinmarketcap.com", is_primary: true },
        ],
        foreignOwnersOfDesiredDomain: [],
      }),
      { action: "demote_all_primary" },
    );
  });

  it("inserts primary when company has no company_domains rows", () => {
    assert.deepEqual(
      planSyncCompanyPrimaryDomain({
        desiredDomain: "acme.com",
        companyDomainRows: [],
        foreignOwnersOfDesiredDomain: [],
      }),
      { action: "insert_primary", domain: "acme.com" },
    );
  });

  it("promotes an existing non-primary row when it matches desired domain", () => {
    assert.deepEqual(
      planSyncCompanyPrimaryDomain({
        desiredDomain: "acme.jp",
        companyDomainRows: [
          { id: PRIMARY_ID, domain: "acme.com", is_primary: true },
          { id: ALIAS_ID, domain: "acme.jp", is_primary: false },
        ],
        foreignOwnersOfDesiredDomain: [],
      }),
      { action: "promote_existing", domainRowId: ALIAS_ID },
    );
  });

  it("demotes then inserts when desired domain is new", () => {
    assert.deepEqual(
      planSyncCompanyPrimaryDomain({
        desiredDomain: "new.example",
        companyDomainRows: [
          { id: PRIMARY_ID, domain: "old.example", is_primary: true },
        ],
        foreignOwnersOfDesiredDomain: [],
      }),
      { action: "demote_then_insert", domain: "new.example" },
    );
  });

  it("conflicts when another company owns the desired domain", () => {
    assert.deepEqual(
      planSyncCompanyPrimaryDomain({
        desiredDomain: "taken.com",
        companyDomainRows: [],
        foreignOwnersOfDesiredDomain: [{ company_id: OTHER_ID }],
      }),
      { action: "conflict", domain: "taken.com" },
    );
  });
});

type SyncMockState = {
  companyDomains: Array<{
    id: string;
    company_id: string;
    domain: string;
    is_primary: boolean;
  }>;
};

function createFullSyncMock(state: SyncMockState) {
  return {
    from(table: string) {
      assert.equal(table, "company_domains");

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
              throw new Error(`Unexpected select eq: ${column}`);
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
    },
  };
}

describe("syncCompanyPrimaryDomainWithClient", () => {
  it("inserts a primary company_domains row when none exists", async () => {
    const state: SyncMockState = { companyDomains: [] };
    await syncCompanyPrimaryDomainWithClient(
      createFullSyncMock(state) as never,
      COMPANY_ID,
      "acme.com",
    );
    assert.equal(state.companyDomains.length, 1);
    assert.equal(state.companyDomains[0]?.domain, "acme.com");
    assert.equal(state.companyDomains[0]?.is_primary, true);
  });

  it("demotes then inserts when desired domain differs from current primary", async () => {
    const state: SyncMockState = {
      companyDomains: [
        {
          id: PRIMARY_ID,
          company_id: COMPANY_ID,
          domain: "old.example",
          is_primary: true,
        },
      ],
    };

    await syncCompanyPrimaryDomainWithClient(
      createFullSyncMock(state) as never,
      COMPANY_ID,
      "new.example",
    );

    const old = state.companyDomains.find((row) => row.id === PRIMARY_ID);
    const inserted = state.companyDomains.find((row) => row.domain === "new.example");
    assert.equal(old?.is_primary, false);
    assert.equal(inserted?.is_primary, true);
  });

  it("promotes an existing alias to primary", async () => {
    const state: SyncMockState = {
      companyDomains: [
        {
          id: PRIMARY_ID,
          company_id: COMPANY_ID,
          domain: "acme.com",
          is_primary: true,
        },
        {
          id: ALIAS_ID,
          company_id: COMPANY_ID,
          domain: "acme.jp",
          is_primary: false,
        },
      ],
    };

    await syncCompanyPrimaryDomainWithClient(
      createFullSyncMock(state) as never,
      COMPANY_ID,
      "acme.jp",
    );

    assert.equal(
      state.companyDomains.find((row) => row.id === PRIMARY_ID)?.is_primary,
      false,
    );
    assert.equal(
      state.companyDomains.find((row) => row.id === ALIAS_ID)?.is_primary,
      true,
    );
  });
});
