import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  materializeCompaniesChunkWithDeps as materializeExhibitorCompanies,
  resolveCompanyIdForRow as resolveExhibitorCompanyIdForRow,
  resolveCreateNewCompanyId as resolveExhibitorCreateNewCompanyId,
  type ImportCompanyCreator as ExhibitorCreator,
  type MaterializeCompanyRow as ExhibitorRow,
} from "@/src/features/exhibitor-import/server/materializeCompanies";
import {
  materializeCompaniesChunkWithDeps as materializeSponsorCompanies,
  resolveCompanyIdForRow as resolveSponsorCompanyIdForRow,
  resolveCreateNewCompanyId as resolveSponsorCreateNewCompanyId,
} from "@/src/features/sponsor-import/server/materializeCompanies";

type StoredCompany = {
  id: string;
  name: string;
  domain: string | null;
  slug: string;
};

type DecisionRow = ExhibitorRow & {
  decision_by: string | null;
  decision_at: string | null;
};

const DECISION_BY = "admin-1";
const DECISION_AT = "2026-11-25T15:00:00.000Z";
const EXISTING_ID = "company-aligned-layer";

function domainFromWebsite(website: string | null): string | null {
  if (!website) return null;
  return website
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0] ?? null;
}

function fakeSupabase(companies: StoredCompany[]): SupabaseClient {
  return {
    from(table: string) {
      const filters: Record<string, string> = {};
      const query = {
        select() {
          return query;
        },
        ilike(_column: string, pattern: string) {
          const name = pattern.replace(/\\/g, "").toLowerCase();
          return Promise.resolve({
            data: companies
              .filter((company) => company.name.toLowerCase() === name)
              .map((company) => ({ id: company.id })),
            error: null,
          });
        },
        eq(column: string, value: string) {
          filters[column] = value;
          return query;
        },
        maybeSingle() {
          if (table === "company_domains") {
            const match = companies.find((company) => company.domain === filters.domain);
            return Promise.resolve({
              data: match ? { company_id: match.id } : null,
              error: null,
            });
          }
          if (filters.slug) {
            const match = companies.find((company) => company.slug === filters.slug);
            return Promise.resolve({ data: match ? { id: match.id } : null, error: null });
          }
          if (filters.domain) {
            const match = companies.find((company) => company.domain === filters.domain);
            return Promise.resolve({ data: match ? { id: match.id } : null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

function savedCreateNew(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: "row-54",
    excel_row_number: 54,
    decision_type: "create_new",
    decision_source: "admin_manual",
    decision_by: DECISION_BY,
    decision_at: DECISION_AT,
    conflict_type: null,
    resolved_company_id: null,
    proposed_company_id: EXISTING_ID,
    normalized_company_name: "Aligned",
    normalized_website: "https://alignedup.com/",
    proposed_slug: "aligned",
    ...overrides,
  };
}

function existingAligned(): StoredCompany {
  return {
    id: EXISTING_ID,
    name: "Aligned",
    domain: "alignedlayer.com",
    slug: "aligned",
  };
}

type MaterializeFn = typeof materializeExhibitorCompanies;
type ResolveFn = typeof resolveExhibitorCompanyIdForRow;
type CreateFn = ExhibitorCreator;

async function materializeSavedDecision(
  materialize: MaterializeFn,
  resolve: ResolveFn,
  row: DecisionRow,
  companies: StoredCompany[],
) {
  const created: Array<{ id: string; name: string; website: string | null; slug: string }> = [];
  const deferred: string[] = [];
  const createCompany: CreateFn = async (input) => {
    const id = `created-${created.length + 1}`;
    created.push({ id, ...input });
    companies.push({
      id,
      name: input.name,
      domain: domainFromWebsite(input.website),
      slug: input.slug,
    });
    return { id };
  };
  const supabase = fakeSupabase(companies);

  const result = await materialize(
    "batch-1",
    { cursor: 0, limit: 15 },
    {
      fetchPendingRows: async () => [row],
      countProgress: async () => ({
        total_resolved_rows: 1,
        rows_with_company_id: row.resolved_company_id ? 1 : 0,
      }),
      persistRowCompanyId: async (_rowId, companyId) => {
        row.resolved_company_id = companyId;
      },
      deferDuplicateNameRow: async (rowId) => {
        deferred.push(rowId);
      },
      resolveCompanyIdForRow: (pending, caches) =>
        resolve(supabase, pending, caches.createdByRowId, caches.createNewByNameKey, createCompany),
    },
  );

  return { result, created, deferred, row };
}

function assertDecisionKept(row: DecisionRow) {
  assert.equal(row.decision_type, "create_new");
  assert.equal(row.decision_source, "admin_manual");
  assert.equal(row.decision_by, DECISION_BY);
  assert.equal(row.decision_at, DECISION_AT);
}

function describeSavedCreateNew(
  label: string,
  materialize: MaterializeFn,
  resolve: ResolveFn,
  resolveCreateNew: typeof resolveExhibitorCreateNewCompanyId,
) {
  describe(label, () => {
    it("creates a separate company when Create new is saved and conflict_type is empty", async () => {
      const companies = [existingAligned()];
      const { result, created, deferred, row } = await materializeSavedDecision(
        materialize,
        resolve,
        savedCreateNew(),
        companies,
      );

      assert.equal(deferred.length, 0);
      assert.equal(created.length, 1);
      assert.equal(created[0]?.slug, "aligned-2");
      assert.equal(created[0]?.name, "Aligned");
      assert.equal(created[0]?.website, "https://alignedup.com/");
      assert.equal(row.resolved_company_id, created[0]?.id);
      assert.notEqual(row.resolved_company_id, EXISTING_ID);
      assert.equal(result.companies_created, 1);
      assert.equal(result.duplicate_name_review_count, 0);
      assertDecisionKept(row);
    });

    it("still creates after matching clears conflict_type on a saved Create new row", async () => {
      const companies = [existingAligned()];
      const { created, deferred, row } = await materializeSavedDecision(
        materialize,
        resolve,
        savedCreateNew({ conflict_type: null }),
        companies,
      );

      assert.equal(deferred.length, 0);
      assert.equal(created.length, 1);
      assert.equal(row.resolved_company_id, created[0]?.id);
      assertDecisionKept(row);
    });

    it("reuses the existing company when the name and domain match", async () => {
      const companies = [existingAligned()];
      const { result, created, deferred, row } = await materializeSavedDecision(
        materialize,
        resolve,
        savedCreateNew({
          normalized_website: "https://alignedlayer.com/",
          proposed_slug: "aligned",
        }),
        companies,
      );

      assert.equal(created.length, 0);
      assert.equal(deferred.length, 0);
      assert.equal(row.resolved_company_id, EXISTING_ID);
      assert.equal(result.companies_created, 0);
      assert.equal(result.materialized_count, 1);
      assertDecisionKept(row);
    });

    it("creates a separate company when Create new is saved and the row has no website", async () => {
      const companies = [existingAligned()];
      const { created, deferred, row } = await materializeSavedDecision(
        materialize,
        resolve,
        savedCreateNew({
          normalized_website: null,
          proposed_slug: "aligned",
        }),
        companies,
      );

      assert.equal(deferred.length, 0);
      assert.equal(created.length, 1);
      assert.equal(created[0]?.website, null);
      assert.equal(created[0]?.slug, "aligned-2");
      assert.equal(row.resolved_company_id, created[0]?.id);
      assert.notEqual(row.resolved_company_id, EXISTING_ID);
      assertDecisionKept(row);
    });

    it("links the company an administrator selected", async () => {
      const companies = [existingAligned()];
      const selectedId = "company-chosen";
      const { created, deferred, row } = await materializeSavedDecision(
        materialize,
        resolve,
        savedCreateNew({
          decision_type: "choose_different",
          proposed_company_id: selectedId,
        }),
        companies,
      );

      assert.equal(created.length, 0);
      assert.equal(deferred.length, 0);
      assert.equal(row.resolved_company_id, selectedId);
      assert.equal(row.decision_type, "choose_different");
      assert.equal(row.decision_by, DECISION_BY);
      assert.equal(row.decision_at, DECISION_AT);
    });

    it("allocates the next slug when the name-derived slug is occupied", async () => {
      const companies = [
        existingAligned(),
        { id: "company-aligned-2", name: "Aligned Two", domain: "aligned-two.example", slug: "aligned-2" },
      ];
      const { created } = await materializeSavedDecision(
        materialize,
        resolve,
        savedCreateNew(),
        companies,
      );

      assert.equal(created[0]?.slug, "aligned-3");
    });

    it("returns a same-name different-domain row to review when Create new was not saved", async () => {
      const companies = [existingAligned()];
      const created: string[] = [];
      const row = savedCreateNew({ decision_type: null, decision_by: null, decision_at: null });
      const resolution = await resolveCreateNew(
        fakeSupabase(companies),
        row,
        new Map(),
        async (input) => {
          created.push(input.slug);
          return { id: "should-not-create" };
        },
      );

      assert.equal(created.length, 0);
      assert.equal("needsReview" in resolution && resolution.needsReview, true);
      if ("needsReview" in resolution) {
        assert.equal(resolution.reason, "same_name_different_domain");
        assert.deepEqual(resolution.candidateIds, [EXISTING_ID]);
      }
      assert.equal(row.decision_type, null);
    });

    it("does not create or clear fields when the row has no company decision", async () => {
      const companies = [existingAligned()];
      const row = savedCreateNew({
        decision_type: null,
        decision_source: null,
        decision_by: null,
        decision_at: null,
      });

      await assert.rejects(
        () => materializeSavedDecision(materialize, resolve, row, companies),
        /no company resolution/,
      );

      assert.equal(companies.length, 1);
      assert.equal(row.resolved_company_id, null);
      assert.equal(row.decision_type, null);
      assert.equal(row.decision_by, null);
      assert.equal(row.decision_at, null);
    });
  });
}

describeSavedCreateNew(
  "exhibitor company materialization",
  materializeExhibitorCompanies,
  resolveExhibitorCompanyIdForRow,
  resolveExhibitorCreateNewCompanyId,
);

describeSavedCreateNew(
  "sponsor company materialization",
  materializeSponsorCompanies as unknown as MaterializeFn,
  resolveSponsorCompanyIdForRow as unknown as ResolveFn,
  resolveSponsorCreateNewCompanyId as unknown as typeof resolveExhibitorCreateNewCompanyId,
);

describe("partner alumni company materialization", () => {
  it("uses the sponsor resolver, so a saved Create new creates a separate company", async () => {
    const source = readFileSync(
      new URL(
        "../../features/partner-alumni-import/server/materializeCompanies.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(
      source,
      /from "@\/src\/features\/sponsor-import\/server\/materializeCompanies"/,
    );
    assert.match(source, /return await resolveCompanyIdForRow\(/);

    const companies = [existingAligned()];
    const { result, created, deferred, row } = await materializeSavedDecision(
      materializeSponsorCompanies as unknown as MaterializeFn,
      resolveSponsorCompanyIdForRow as unknown as ResolveFn,
      savedCreateNew({ conflict_type: null }),
      companies,
    );

    assert.equal(deferred.length, 0);
    assert.equal(created.length, 1);
    assert.equal(created[0]?.website, "https://alignedup.com/");
    assert.notEqual(row.resolved_company_id, EXISTING_ID);
    assert.equal(result.duplicate_name_review_count, 0);
    assertDecisionKept(row);
  });
});
