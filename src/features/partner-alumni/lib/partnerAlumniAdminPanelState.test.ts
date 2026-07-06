import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dateInputToIso,
  isoToDateInput,
  mergePartnerAlumniAdminServerRefresh,
  partnerAlumniHeaderFormValues,
  resolvePartnerAlumniHeaderFormSource,
} from "@/src/features/partner-alumni/lib/partnerAlumniAdminPanelState";
import type { PartnerAlumniAdminData } from "@/src/features/partner-alumni/server/partnerAlumniAdmin";

function versionSummary(
  overrides: Partial<PartnerAlumniAdminData["versions"][number]> &
    Pick<PartnerAlumniAdminData["versions"][number], "id">,
): PartnerAlumniAdminData["versions"][number] {
  return {
    version_label: null,
    recognition_label: null,
    primary_source_url: null,
    source_checked_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    member_count: 0,
    is_current: false,
    ...overrides,
  };
}

describe("mergePartnerAlumniAdminServerRefresh", () => {
  it("preserves client-selected version headers after server refresh defaults to current", () => {
    const prev: PartnerAlumniAdminData = {
      program: {
        id: "program-1",
        event_series_id: "series-1",
        current_version_id: "version-current",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
      versions: [
        versionSummary({
          id: "version-current",
          version_label: "Current",
          is_current: true,
          member_count: 2,
        }),
        versionSummary({
          id: "version-draft",
          version_label: "Draft refresh",
          recognition_label: "Partners",
          member_count: 1,
        }),
      ],
      selected_version: {
        ...versionSummary({
          id: "version-draft",
          version_label: "Draft refresh",
          recognition_label: "Partners",
          member_count: 1,
        }),
        members: [
          {
            id: "member-1",
            event_partner_alumni_version_id: "version-draft",
            company_id: "company-1",
            display_order: 1,
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
            companies: { id: "company-1", name: "Acme", domain: null },
          },
        ],
      },
    };

    const server: PartnerAlumniAdminData = {
      program: prev.program,
      versions: [
        versionSummary({
          id: "version-current",
          version_label: "Current",
          is_current: true,
          member_count: 2,
        }),
        versionSummary({
          id: "version-draft",
          version_label: "Draft refresh saved",
          recognition_label: "Partners updated",
          primary_source_url: "https://example.com/partners",
          source_checked_at: "2026-07-02T00:00:00.000Z",
          member_count: 1,
        }),
      ],
      selected_version: {
        ...versionSummary({
          id: "version-current",
          version_label: "Current",
          is_current: true,
          member_count: 2,
        }),
        members: [],
      },
    };

    const merged = mergePartnerAlumniAdminServerRefresh(prev, server, "version-draft");

    assert.equal(merged.selected_version?.id, "version-draft");
    assert.equal(merged.selected_version?.version_label, "Draft refresh saved");
    assert.equal(merged.selected_version?.recognition_label, "Partners updated");
    assert.equal(merged.selected_version?.members.length, 1);
  });
});

describe("resolvePartnerAlumniHeaderFormSource", () => {
  it("reads header fields from versions list when selected detail is for another version", () => {
    const data: PartnerAlumniAdminData = {
      program: null,
      versions: [
        versionSummary({
          id: "version-a",
          version_label: "A label",
          source_checked_at: "2026-07-03T00:00:00.000Z",
        }),
      ],
      selected_version: null,
    };

    const source = resolvePartnerAlumniHeaderFormSource(data, "version-a");
    assert.equal(source?.version_label, "A label");
    assert.equal(partnerAlumniHeaderFormValues(source).sourceCheckedAt, "2026-07-03");
  });
});

describe("date helpers", () => {
  it("round-trips date input values", () => {
    assert.equal(isoToDateInput("2026-07-01T12:00:00.000Z"), "2026-07-01");
    assert.equal(dateInputToIso("2026-07-01"), "2026-07-01T00:00:00.000Z");
    assert.equal(dateInputToIso(""), null);
  });
});
