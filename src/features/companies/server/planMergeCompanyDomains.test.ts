import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildForeignOwnerByIdentity,
  mergeCompanyDomainsBlockerStrings,
  pickMergeTextField,
  planMergeCompanyDomains,
} from "@/src/features/companies/server/planMergeCompanyDomains";

const CANONICAL = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DUPLICATE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const THIRD = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("pickMergeTextField", () => {
  it("picks by strategy", () => {
    assert.equal(pickMergeTextField("a.com", "b.com", "canonical"), "a.com");
    assert.equal(pickMergeTextField("a.com", "b.com", "duplicate"), "b.com");
    assert.equal(pickMergeTextField(null, "b.com", "non_empty"), "b.com");
    assert.equal(pickMergeTextField("a.com", null, "non_empty"), "a.com");
  });
});

describe("planMergeCompanyDomains", () => {
  it("moves duplicate domains and keeps overlaps as deletes", () => {
    const plan = planMergeCompanyDomains({
      canonicalCompanyId: CANONICAL,
      duplicateCompanyId: DUPLICATE,
      canonicalDomain: "acme.com",
      duplicateDomain: "acme.io",
      canonicalWebsite: "https://acme.com/",
      duplicateWebsite: "https://acme.io/",
      domainStrategy: "canonical",
      websiteStrategy: "canonical",
      canonicalDomainRows: [
        {
          id: "row-can-primary",
          company_id: CANONICAL,
          domain: "acme.com",
          is_primary: true,
        },
      ],
      duplicateDomainRows: [
        {
          id: "row-dup-primary",
          company_id: DUPLICATE,
          domain: "acme.io",
          is_primary: true,
        },
        {
          id: "row-dup-overlap",
          company_id: DUPLICATE,
          domain: "acme.com",
          is_primary: false,
        },
      ],
      foreignOwnerByIdentity: new Map(),
    });

    assert.equal(plan.blockers.length, 0);
    assert.deepEqual(plan.moveDuplicateRowIds, ["row-dup-primary"]);
    assert.deepEqual(plan.deleteDuplicateRowIds, ["row-dup-overlap"]);
    assert.equal(plan.primaryDomain, "acme.com");
  });

  it("blocks when website identity differs from selected Primary", () => {
    const plan = planMergeCompanyDomains({
      canonicalCompanyId: CANONICAL,
      duplicateCompanyId: DUPLICATE,
      canonicalDomain: "acme.com",
      duplicateDomain: "other.com",
      canonicalWebsite: "https://other.com/",
      duplicateWebsite: "https://acme.com/",
      domainStrategy: "canonical",
      websiteStrategy: "canonical",
      canonicalDomainRows: [],
      duplicateDomainRows: [],
      foreignOwnerByIdentity: new Map(),
    });

    assert.ok(
      plan.blockers.some((b) => b.code === "merge_website_primary_identity_mismatch"),
    );
  });

  it("blocks no_identity website with a Primary Identity", () => {
    const plan = planMergeCompanyDomains({
      canonicalCompanyId: CANONICAL,
      duplicateCompanyId: DUPLICATE,
      canonicalDomain: "acme.com",
      duplicateDomain: null,
      canonicalWebsite: "https://discord.com/invite/acme",
      duplicateWebsite: null,
      domainStrategy: "canonical",
      websiteStrategy: "canonical",
      canonicalDomainRows: [],
      duplicateDomainRows: [],
      foreignOwnerByIdentity: new Map(),
    });

    assert.ok(
      plan.blockers.some((b) => b.code === "merge_website_no_identity_with_primary"),
    );
  });

  it("blocks website identity when Primary is empty", () => {
    const plan = planMergeCompanyDomains({
      canonicalCompanyId: CANONICAL,
      duplicateCompanyId: DUPLICATE,
      canonicalDomain: null,
      duplicateDomain: null,
      canonicalWebsite: "https://acme.com/",
      duplicateWebsite: null,
      domainStrategy: "canonical",
      websiteStrategy: "canonical",
      canonicalDomainRows: [],
      duplicateDomainRows: [],
      foreignOwnerByIdentity: new Map(),
    });

    assert.ok(
      plan.blockers.some((b) => b.code === "merge_website_identity_without_primary"),
    );
  });

  it("blocks third-party ownership", () => {
    const plan = planMergeCompanyDomains({
      canonicalCompanyId: CANONICAL,
      duplicateCompanyId: DUPLICATE,
      canonicalDomain: "acme.com",
      duplicateDomain: "held.com",
      canonicalWebsite: "https://acme.com/",
      duplicateWebsite: "https://held.com/",
      domainStrategy: "canonical",
      websiteStrategy: "canonical",
      canonicalDomainRows: [
        {
          id: "row-can",
          company_id: CANONICAL,
          domain: "acme.com",
          is_primary: true,
        },
      ],
      duplicateDomainRows: [
        {
          id: "row-dup",
          company_id: DUPLICATE,
          domain: "held.com",
          is_primary: true,
        },
      ],
      foreignOwnerByIdentity: new Map([["held.com", THIRD]]),
    });

    assert.ok(plan.blockers.some((b) => b.code === "merge_company_domain_third_party"));
    assert.ok(
      mergeCompanyDomainsBlockerStrings(plan.blockers).some((m) =>
        m.includes("held.com"),
      ),
    );
  });

  it("allows aligned website and domain with moves", () => {
    const plan = planMergeCompanyDomains({
      canonicalCompanyId: CANONICAL,
      duplicateCompanyId: DUPLICATE,
      canonicalDomain: "gate.com",
      duplicateDomain: "gate.io",
      canonicalWebsite: "https://www.gate.com/",
      duplicateWebsite: "https://www.gate.io/",
      domainStrategy: "canonical",
      websiteStrategy: "canonical",
      canonicalDomainRows: [
        {
          id: "c1",
          company_id: CANONICAL,
          domain: "gate.com",
          is_primary: true,
        },
      ],
      duplicateDomainRows: [
        {
          id: "d1",
          company_id: DUPLICATE,
          domain: "gate.io",
          is_primary: true,
        },
      ],
      foreignOwnerByIdentity: new Map(),
    });

    assert.equal(plan.blockers.length, 0);
    assert.deepEqual(plan.moveDuplicateRowIds, ["d1"]);
    assert.equal(plan.primaryDomain, "gate.com");
    assert.equal(plan.websiteIdentityKey, "gate.com");
  });
});

describe("buildForeignOwnerByIdentity", () => {
  it("ignores the merge pair and records third parties", () => {
    const map = buildForeignOwnerByIdentity({
      canonicalCompanyId: CANONICAL,
      duplicateCompanyId: DUPLICATE,
      allDomainRows: [
        { company_id: CANONICAL, domain: "a.com" },
        { company_id: DUPLICATE, domain: "b.com" },
        { company_id: THIRD, domain: "c.com" },
      ],
      activeCompanyDomains: [
        { id: THIRD, domain: "d.com" },
        { id: CANONICAL, domain: "a.com" },
      ],
    });

    assert.equal(map.get("c.com"), THIRD);
    assert.equal(map.get("d.com"), THIRD);
    assert.equal(map.has("a.com"), false);
    assert.equal(map.has("b.com"), false);
  });
});
