import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildIdentityOwnerIndex,
  foreignOwnersForIdentity,
  planCompanyIdentityPhase1Repair,
  type Phase1RepairCompany,
  type Phase1RepairDomainRow,
} from "./companyIdentityPhase1Repair";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const PRIMARY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALIAS_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const FACEBOOK_WEBSITE =
  "https://www.facebook.com/profile.php?id=100068135449341&utm_source=x";
const FACEBOOK_IDENTITY = "facebook.com/profile.php?id=100068135449341";

function company(overrides: Partial<Phase1RepairCompany> = {}): Phase1RepairCompany {
  return {
    id: COMPANY_ID,
    name: "Test Co",
    website: FACEBOOK_WEBSITE,
    domain: null,
    ...overrides,
  };
}

describe("planCompanyIdentityPhase1Repair", () => {
  it("repairs null domain + missing primary", () => {
    const decision = planCompanyIdentityPhase1Repair({
      company: company({ domain: null, website: FACEBOOK_WEBSITE }),
      companyDomainRows: [],
      foreignOwnersOfDesiredIdentity: [],
    });

    assert.equal(decision.status, "repair");
    if (decision.status !== "repair") return;
    assert.equal(decision.website, FACEBOOK_WEBSITE);
    assert.equal(decision.beforeDomain, null);
    assert.equal(decision.afterDomain, FACEBOOK_IDENTITY);
    assert.equal(decision.setCompanyDomain, true);
    assert.deepEqual(decision.primaryAction, {
      action: "insert_primary",
      domain: FACEBOOK_IDENTITY,
    });
  });

  it("repairs mismatched primary while keeping website byte-for-byte", () => {
    const website = "https://www.linkedin.com/company/hemi-labs/";
    const rows: Phase1RepairDomainRow[] = [
      { id: PRIMARY_ID, domain: "hemi.xyz", is_primary: true },
      { id: ALIAS_ID, domain: "linkedin.com/company/hemi-labs", is_primary: false },
    ];

    const decision = planCompanyIdentityPhase1Repair({
      company: company({
        website,
        domain: "linkedin.com/company/hemi-labs",
      }),
      companyDomainRows: rows,
      foreignOwnersOfDesiredIdentity: [],
    });

    assert.equal(decision.status, "repair");
    if (decision.status !== "repair") return;
    assert.equal(decision.website, website);
    assert.equal(decision.setCompanyDomain, false);
    assert.equal(decision.beforePrimaryDomain, "hemi.xyz");
    assert.equal(decision.afterPrimaryDomain, "linkedin.com/company/hemi-labs");
    assert.deepEqual(decision.primaryAction, {
      action: "promote_existing",
      domainRowId: ALIAS_ID,
    });
  });

  it("promotes an existing matching alias and retains old primary as alias", () => {
    const rows: Phase1RepairDomainRow[] = [
      { id: PRIMARY_ID, domain: "old.example", is_primary: true },
      { id: ALIAS_ID, domain: "acme.com", is_primary: false },
    ];

    const decision = planCompanyIdentityPhase1Repair({
      company: company({
        website: "https://www.acme.com/about",
        domain: "acme.com",
      }),
      companyDomainRows: rows,
      foreignOwnersOfDesiredIdentity: [],
    });

    assert.equal(decision.status, "repair");
    if (decision.status !== "repair") return;
    assert.deepEqual(decision.primaryAction, {
      action: "promote_existing",
      domainRowId: ALIAS_ID,
    });
    assert.equal(
      decision.beforeDomainRows.some((row) => row.id === PRIMARY_ID && row.domain === "old.example"),
      true,
    );
  });

  it("inserts primary when domain matches website but no company_domains rows exist", () => {
    const decision = planCompanyIdentityPhase1Repair({
      company: company({
        website: "https://r7miner.com/",
        domain: "r7miner.com",
      }),
      companyDomainRows: [],
      foreignOwnersOfDesiredIdentity: [],
    });

    assert.equal(decision.status, "repair");
    if (decision.status !== "repair") return;
    assert.equal(decision.setCompanyDomain, false);
    assert.deepEqual(decision.primaryAction, {
      action: "insert_primary",
      domain: "r7miner.com",
    });
  });

  it("demotes then inserts when desired identity is new", () => {
    const decision = planCompanyIdentityPhase1Repair({
      company: company({
        website: "https://www.facebook.com/4catssuite/",
        domain: null,
      }),
      companyDomainRows: [
        { id: PRIMARY_ID, domain: "unrelated.example", is_primary: true },
      ],
      foreignOwnersOfDesiredIdentity: [],
    });

    assert.equal(decision.status, "repair");
    if (decision.status !== "repair") return;
    assert.equal(decision.afterDomain, "facebook.com/4catssuite");
    assert.deepEqual(decision.primaryAction, {
      action: "demote_then_insert",
      domain: "facebook.com/4catssuite",
    });
  });

  it("skips cross-company identity conflicts", () => {
    const decision = planCompanyIdentityPhase1Repair({
      company: company({
        website: "https://aptosnetwork.com/",
        domain: "aptosnetwork.com",
      }),
      companyDomainRows: [
        { id: PRIMARY_ID, domain: "aptosfoundation.org", is_primary: true },
      ],
      foreignOwnersOfDesiredIdentity: [{ company_id: OTHER_ID }],
    });

    assert.equal(decision.status, "skipped_conflict");
    if (decision.status !== "skipped_conflict") return;
    assert.match(decision.reason, /owned by another company/i);
  });

  it("skips no_identity websites", () => {
    const decision = planCompanyIdentityPhase1Repair({
      company: company({
        website: "https://discord.com/invite/abc",
        domain: null,
      }),
      companyDomainRows: [],
      foreignOwnersOfDesiredIdentity: [],
    });

    assert.equal(decision.status, "skipped_no_identity");
  });

  it("skips multi-primary companies", () => {
    const decision = planCompanyIdentityPhase1Repair({
      company: company({
        website: "https://acme.com",
        domain: "acme.com",
      }),
      companyDomainRows: [
        { id: PRIMARY_ID, domain: "acme.com", is_primary: true },
        { id: ALIAS_ID, domain: "acme.jp", is_primary: true },
      ],
      foreignOwnersOfDesiredIdentity: [],
    });

    assert.equal(decision.status, "skipped_multi_primary");
  });

  it("is a no-op when domain and primary already match", () => {
    const decision = planCompanyIdentityPhase1Repair({
      company: company({
        website: FACEBOOK_WEBSITE,
        domain: FACEBOOK_IDENTITY,
      }),
      companyDomainRows: [
        { id: PRIMARY_ID, domain: FACEBOOK_IDENTITY, is_primary: true },
      ],
      foreignOwnersOfDesiredIdentity: [],
    });

    assert.equal(decision.status, "unchanged");
  });
});

describe("buildIdentityOwnerIndex / foreignOwnersForIdentity", () => {
  it("detects ownership via companies.domain and company_domains", () => {
    const owners = buildIdentityOwnerIndex({
      companies: [
        company({ id: COMPANY_ID, domain: "acme.com" }),
        company({ id: OTHER_ID, domain: null, website: null, name: "Other" }),
      ],
      domainRows: [
        {
          id: ALIAS_ID,
          company_id: OTHER_ID,
          domain: "facebook.com/4catssuite",
          is_primary: false,
        },
      ],
    });

    assert.deepEqual(foreignOwnersForIdentity(owners, "acme.com", OTHER_ID), [
      { company_id: COMPANY_ID },
    ]);
    assert.deepEqual(
      foreignOwnersForIdentity(owners, "facebook.com/4catssuite", COMPANY_ID),
      [{ company_id: OTHER_ID }],
    );
    assert.deepEqual(foreignOwnersForIdentity(owners, "acme.com", COMPANY_ID), []);
  });
});
