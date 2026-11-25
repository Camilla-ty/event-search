import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { uniqueViolationUserMessage as exhibitorUniqueViolationUserMessage } from "@/src/features/exhibitor-import/server/errors";
import { uniqueViolationUserMessage as sponsorUniqueViolationUserMessage } from "@/src/features/sponsor-import/server/errors";
import { resolveImportRowMatchReason as exhibitorMatchReason } from "@/src/features/exhibitor-import/importRowMatchReason";
import { resolveImportRowMatchReason as sponsorMatchReason } from "@/src/features/sponsor-import/importRowMatchReason";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveManualCompanySlug } from "../slugify";
import {
  companyNameDomainCacheKey,
  decideCompanyCreate,
  isExplicitDuplicateNameCreate,
  resolveCompanyCreate,
} from "./duplicateCompanyName";

const EXISTING_ID = "company-scale-com";

function lookupClient(state: {
  byName: { id: string }[];
  byCompanyDomain: { id: string } | null;
  byDomainTable: { company_id: string } | null;
}): SupabaseClient {
  return {
    from(table: string) {
      const query = {
        select() {
          return query;
        },
        ilike() {
          return Promise.resolve({ data: state.byName, error: null });
        },
        eq() {
          return query;
        },
        maybeSingle() {
          if (table === "company_domains") {
            return Promise.resolve({ data: state.byDomainTable, error: null });
          }
          return Promise.resolve({ data: state.byCompanyDomain, error: null });
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

describe("isExplicitDuplicateNameCreate", () => {
  it("treats a saved create_new decision as confirmation without a conflict flag", () => {
    assert.equal(
      isExplicitDuplicateNameCreate({ decision_type: "create_new", conflict_type: null }),
      true,
    );
    assert.equal(
      isExplicitDuplicateNameCreate({
        decision_type: "create_new",
        conflict_type: "uniqueness_violation",
      }),
      true,
    );
    assert.equal(
      isExplicitDuplicateNameCreate({ decision_type: "use_matched", conflict_type: null }),
      false,
    );
    assert.equal(
      isExplicitDuplicateNameCreate({
        decision_type: null,
        conflict_type: "uniqueness_violation",
      }),
      false,
    );
  });
});

describe("decideCompanyCreate", () => {
  it("reuses a company with the same name and the same domain", () => {
    assert.deepEqual(
      decideCompanyCreate({
        domain: "scale.com",
        sameNameCompanyIds: [EXISTING_ID],
        sameDomainCompanyId: EXISTING_ID,
        explicitCreate: false,
      }),
      { action: "reuse", companyId: EXISTING_ID },
    );
  });

  it("sends a same name with a different domain to review", () => {
    assert.deepEqual(
      decideCompanyCreate({
        domain: "scaleai.ca",
        sameNameCompanyIds: [EXISTING_ID],
        sameDomainCompanyId: null,
        explicitCreate: false,
      }),
      {
        action: "review",
        reason: "same_name_different_domain",
        candidateIds: [EXISTING_ID],
      },
    );
  });

  it("sends a same name with no domain to review", () => {
    assert.deepEqual(
      decideCompanyCreate({
        domain: null,
        sameNameCompanyIds: [EXISTING_ID],
        sameDomainCompanyId: null,
        explicitCreate: false,
      }),
      {
        action: "review",
        reason: "same_name_no_domain",
        candidateIds: [EXISTING_ID],
      },
    );
  });

  it("creates a separate company when the admin explicitly confirms it", () => {
    assert.deepEqual(
      decideCompanyCreate({
        domain: "scaleai.ca",
        sameNameCompanyIds: [EXISTING_ID],
        sameDomainCompanyId: null,
        explicitCreate: true,
      }),
      { action: "create" },
    );
    assert.deepEqual(
      decideCompanyCreate({
        domain: null,
        sameNameCompanyIds: [EXISTING_ID],
        sameDomainCompanyId: null,
        explicitCreate: true,
      }),
      { action: "create" },
    );
  });

  it("still reuses the same domain when the admin asked to create", () => {
    assert.deepEqual(
      decideCompanyCreate({
        domain: "scale.com",
        sameNameCompanyIds: [EXISTING_ID],
        sameDomainCompanyId: EXISTING_ID,
        explicitCreate: true,
      }),
      { action: "reuse", companyId: EXISTING_ID },
    );
  });
});

describe("resolveCompanyCreate", () => {
  it("does not let a name-and-domain cache link a different domain or a missing domain", async () => {
    const cache = new Map<string, string>();
    const supabase = lookupClient({
      byName: [{ id: EXISTING_ID }],
      byCompanyDomain: { id: EXISTING_ID },
      byDomainTable: null,
    });
    let creates = 0;

    const reused = await resolveCompanyCreate({
      supabase,
      name: "Scale AI",
      website: "https://scale.com",
      explicitCreate: false,
      cache,
      create: async () => {
        creates += 1;
        return { id: "should-not-create" };
      },
    });
    assert.deepEqual(reused, { companyId: EXISTING_ID, created: false });

    const differentDomain = await resolveCompanyCreate({
      supabase: lookupClient({
        byName: [{ id: EXISTING_ID }],
        byCompanyDomain: null,
        byDomainTable: null,
      }),
      name: "Scale AI",
      website: "https://www.scaleai.ca",
      explicitCreate: false,
      cache,
      create: async () => {
        creates += 1;
        return { id: "should-not-create" };
      },
    });
    assert.equal("needsReview" in differentDomain && differentDomain.needsReview, true);
    if ("needsReview" in differentDomain) {
      assert.equal(differentDomain.reason, "same_name_different_domain");
      assert.deepEqual(differentDomain.candidateIds, [EXISTING_ID]);
    }

    const noDomain = await resolveCompanyCreate({
      supabase: lookupClient({
        byName: [{ id: EXISTING_ID }],
        byCompanyDomain: null,
        byDomainTable: null,
      }),
      name: "Scale AI",
      website: null,
      explicitCreate: false,
      cache,
      create: async () => {
        creates += 1;
        return { id: "should-not-create" };
      },
    });
    assert.equal("needsReview" in noDomain && noDomain.needsReview, true);
    if ("needsReview" in noDomain) {
      assert.equal(noDomain.reason, "same_name_no_domain");
    }
    assert.equal(creates, 0);
    assert.equal(cache.get(companyNameDomainCacheKey("Scale AI", "scale.com") ?? ""), EXISTING_ID);
    assert.equal(companyNameDomainCacheKey("Scale AI", null), null);
  });

  it("creates a new company after an explicit admin decision and does not link the existing one", async () => {
    const cache = new Map<string, string>([
      [companyNameDomainCacheKey("Scale AI", "scale.com") ?? "", EXISTING_ID],
    ]);
    const created = await resolveCompanyCreate({
      supabase: lookupClient({
        byName: [{ id: EXISTING_ID }],
        byCompanyDomain: null,
        byDomainTable: null,
      }),
      name: "Scale AI",
      website: "https://www.scaleai.ca",
      explicitCreate: true,
      cache,
      create: async () => ({ id: "company-scaleai-ca" }),
    });

    assert.deepEqual(created, { companyId: "company-scaleai-ca", created: true });
    assert.equal(cache.get(companyNameDomainCacheKey("Scale AI", "scale.com") ?? ""), EXISTING_ID);
    assert.equal(
      cache.get(companyNameDomainCacheKey("Scale AI", "scaleai.ca") ?? ""),
      "company-scaleai-ca",
    );
  });

  it("does not link an existing name when creating the confirmed company hits the legacy name constraint", async () => {
    await assert.rejects(
      () =>
        resolveCompanyCreate({
          supabase: lookupClient({
            byName: [{ id: EXISTING_ID }],
            byCompanyDomain: null,
            byDomainTable: null,
          }),
          name: "Scale AI",
          website: "https://www.scaleai.ca",
          explicitCreate: true,
          cache: new Map(),
          create: async () => {
            throw new Error(
              'duplicate key value violates unique constraint "sponsors_name_key"',
            );
          },
        }),
      /sponsors_name_key/,
    );
  });
});

describe("manual company slug and name errors", () => {
  it("keeps a different valid slug when the name-derived slug already exists", () => {
    assert.equal(resolveManualCompanySlug("Scale AI", "scale-ai-ca"), "scale-ai-ca");
    assert.notEqual(resolveManualCompanySlug("Scale AI", "scale-ai-ca"), "scale-ai");
    assert.equal(resolveManualCompanySlug("Scale AI", ""), "scale-ai");
  });

  it("names the legacy name constraint instead of a generic wait message", () => {
    const message =
      'duplicate key value violates unique constraint "sponsors_name_key"';
    assert.equal(
      sponsorUniqueViolationUserMessage(message),
      "A company with this exact name already exists.",
    );
    assert.equal(
      exhibitorUniqueViolationUserMessage(message),
      "A company with this exact name already exists.",
    );
    assert.equal(
      sponsorUniqueViolationUserMessage(
        'duplicate key value violates unique constraint "companies_slug_key"',
      ),
      "A company with this slug already exists.",
    );
  });

  it("explains a duplicate-name review row to the admin", () => {
    const row = { conflict_type: "uniqueness_violation" } as never;
    assert.deepEqual(sponsorMatchReason(row), { kind: "uniqueness_violation" });
    assert.deepEqual(exhibitorMatchReason(row), { kind: "uniqueness_violation" });
  });
});
