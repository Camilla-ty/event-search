import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectExhibitorMergeEditionIds,
  defaultCompanyMergeResolutions,
  mapCompanyMergePreviewResult,
  mapCompanyMergeExecuteResult,
  type CompanyMergeExecutionSnapshot,
} from "@/src/features/companies/server/companyMerge";
import {
  parseCompanyMergeResolutions,
  validateResolutionsAgainstPreview,
} from "@/src/features/companies/server/companyMergeAdmin";
import { buildInitialResolutionsFromPreview } from "@/src/features/companies/components/admin/merge/mergeWizardResolutions";

const EDITION_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EDITION_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function previewPayload(overrides: Record<string, unknown> = {}) {
  return {
    preview_snapshot: {
      schema_version: 2,
      generated_at: "2026-07-23T00:00:00.000Z",
      canonical_company_id: "11111111-1111-1111-1111-111111111111",
      duplicate_company_id: "22222222-2222-2222-2222-222222222222",
      companies: {
        canonical: {
          id: "11111111-1111-1111-1111-111111111111",
          name: "Canonical Co",
          slug: "canonical",
          domain: "canonical.com",
          website: "https://canonical.com",
          logo_url: null,
          logo_source: null,
          logo_status: null,
          city_id: null,
          aliases: [],
          created_at: null,
          status: "active",
          merged_into_company_id: null,
          sponsor_link_count: 0,
        },
        duplicate: {
          id: "22222222-2222-2222-2222-222222222222",
          name: "Duplicate Co",
          slug: "duplicate",
          domain: "duplicate.com",
          website: "https://duplicate.com",
          logo_url: null,
          logo_source: null,
          logo_status: null,
          city_id: null,
          aliases: [],
          created_at: null,
          status: "active",
          merged_into_company_id: null,
          sponsor_link_count: 0,
        },
      },
      impact: {
        event_sponsors_to_repoint: 0,
        event_edition_organizers_to_repoint: 0,
        event_exhibitors_to_repoint: 2,
        import_rows_proposed_to_repoint: 0,
        import_rows_resolved_to_repoint: 0,
        draft_links_to_repoint: 0,
        partner_alumni_version_members_to_repoint: 0,
      },
      sponsorship_conflicts: [],
      organizer_conflicts: [],
      exhibitor_conflicts: [
        {
          event_edition_id: EDITION_A,
          edition_name: "Demo",
          canonical_link: { tier_rank: 1, tier_label: "Platinum", display_order: 1 },
          duplicate_link: { tier_rank: 2, tier_label: "Gold", display_order: 2 },
        },
      ],
      draft_link_conflicts: [],
      required_resolutions: {
        sponsorship_conflicts: [],
        organizer_conflicts: [],
        exhibitor_conflicts: [EDITION_A],
        draft_link_conflicts: [],
      },
      field_differences: {},
      blockers: [],
      warnings: [],
      executable: false,
      ...overrides,
    },
  };
}

describe("company merge exhibitor payload mapping", () => {
  it("maps exhibitor impact, tier conflicts, and required edition resolutions", () => {
    const mapped = mapCompanyMergePreviewResult(previewPayload());
    assert.equal(mapped.preview_snapshot.impact.event_exhibitors_to_repoint, 2);
    assert.equal(mapped.preview_snapshot.exhibitor_conflicts.length, 1);
    assert.deepEqual(mapped.preview_snapshot.required_resolutions.exhibitor_conflicts, [
      EDITION_A,
    ]);
  });

  it("defaults missing exhibitor fields to empty", () => {
    const raw = previewPayload();
    const snap = raw.preview_snapshot as Record<string, unknown>;
    delete snap.exhibitor_conflicts;
    const impact = snap.impact as Record<string, unknown>;
    delete impact.event_exhibitors_to_repoint;
    const required = snap.required_resolutions as Record<string, unknown>;
    delete required.exhibitor_conflicts;

    const mapped = mapCompanyMergePreviewResult(raw);
    assert.equal(mapped.preview_snapshot.impact.event_exhibitors_to_repoint, 0);
    assert.deepEqual(mapped.preview_snapshot.exhibitor_conflicts, []);
    assert.deepEqual(mapped.preview_snapshot.required_resolutions.exhibitor_conflicts, []);
  });
});

describe("company merge exhibitor tier resolution validation", () => {
  it("includes exhibitor_conflicts in default resolutions", () => {
    const defaults = defaultCompanyMergeResolutions();
    assert.deepEqual(defaults.exhibitor_conflicts, []);
  });

  it("parses keep_canonical / keep_duplicate_tier strategies", () => {
    const parsed = parseCompanyMergeResolutions({
      schema_version: 2,
      exhibitor_conflicts: [
        { event_edition_id: EDITION_A, strategy: "keep_duplicate_tier" },
      ],
    });
    assert.equal(parsed.exhibitor_conflicts[0]?.strategy, "keep_duplicate_tier");
  });

  it("requires a strategy for each conflicting edition", () => {
    const preview = mapCompanyMergePreviewResult(previewPayload()).preview_snapshot;
    const resolutions = parseCompanyMergeResolutions({
      schema_version: 2,
      exhibitor_conflicts: [],
    });
    assert.throws(
      () => validateResolutionsAgainstPreview(resolutions, preview),
      /Missing exhibitor conflict strategy/,
    );
  });

  it("accepts keep_canonical from the wizard defaults", () => {
    const preview = mapCompanyMergePreviewResult(previewPayload()).preview_snapshot;
    const resolutions = buildInitialResolutionsFromPreview(preview);
    assert.equal(resolutions.exhibitor_conflicts[0]?.strategy, "keep_canonical");
    assert.doesNotThrow(() => validateResolutionsAgainstPreview(resolutions, preview));
  });

  it("rejects strategies for editions that are not required", () => {
    const preview = mapCompanyMergePreviewResult(previewPayload()).preview_snapshot;
    const resolutions = parseCompanyMergeResolutions({
      schema_version: 2,
      exhibitor_conflicts: [
        { event_edition_id: EDITION_A, strategy: "keep_canonical" },
        { event_edition_id: EDITION_B, strategy: "keep_canonical" },
      ],
    });
    assert.throws(
      () => validateResolutionsAgainstPreview(resolutions, preview),
      /Unexpected exhibitor conflict strategy/,
    );
  });
});

describe("collectExhibitorMergeEditionIds", () => {
  it("reads affected edition ids from the execution repoint map", () => {
    const execution = {
      schema_version: 2,
      phase: 2,
      completed_at: "2026-07-23T00:00:00.000Z",
      actions: {
        soft_archived_duplicate: true,
        event_sponsors_repointed: 0,
        event_sponsors_deleted: 0,
        event_sponsors_updated: 0,
        event_edition_organizers_repointed: 0,
        event_edition_organizers_deleted: 0,
        event_edition_organizers_updated: 0,
        event_exhibitors_repointed: 1,
        event_exhibitors_deleted: 0,
        event_exhibitors_updated: 0,
        partner_alumni_version_members_repointed: 0,
        partner_alumni_version_members_deleted: 0,
        partner_alumni_version_members_updated: 0,
        import_rows_proposed_repointed: 0,
        import_rows_resolved_repointed: 0,
        draft_links_repointed: 0,
        draft_links_deleted: 0,
        aliases_merged: true,
        field_resolutions_applied: true,
        slug_redirects_created: 0,
      },
      repoint_map: {
        event_exhibitors_affected_edition_ids: [EDITION_A, EDITION_A],
      },
    } satisfies CompanyMergeExecutionSnapshot;

    assert.deepEqual(collectExhibitorMergeEditionIds(execution), [EDITION_A]);
  });
});

describe("mapCompanyMergeExecuteResult exhibitor actions", () => {
  it("maps exhibitor action counters", () => {
    const result = mapCompanyMergeExecuteResult({
      merge_id: "33333333-3333-3333-3333-333333333333",
      status: "completed",
      canonical_company_id: "11111111-1111-1111-1111-111111111111",
      duplicate_company_id: "22222222-2222-2222-2222-222222222222",
      preview_snapshot: previewPayload().preview_snapshot,
      execution_snapshot: {
        schema_version: 2,
        phase: 2,
        completed_at: "2026-07-23T00:00:00.000Z",
        actions: {
          soft_archived_duplicate: true,
          event_sponsors_repointed: 0,
          event_sponsors_deleted: 0,
          event_sponsors_updated: 0,
          event_edition_organizers_repointed: 0,
          event_edition_organizers_deleted: 0,
          event_edition_organizers_updated: 0,
          event_exhibitors_repointed: 1,
          event_exhibitors_deleted: 1,
          event_exhibitors_updated: 1,
          partner_alumni_version_members_repointed: 0,
          partner_alumni_version_members_deleted: 0,
          partner_alumni_version_members_updated: 0,
          import_rows_proposed_repointed: 0,
          import_rows_resolved_repointed: 0,
          draft_links_repointed: 0,
          draft_links_deleted: 0,
          aliases_merged: true,
          field_resolutions_applied: true,
          slug_redirects_created: 0,
        },
        repoint_map: {},
      },
    });

    assert.equal(result.execution_snapshot.actions.event_exhibitors_repointed, 1);
    assert.equal(result.execution_snapshot.actions.event_exhibitors_deleted, 1);
    assert.equal(result.execution_snapshot.actions.event_exhibitors_updated, 1);
  });
});
