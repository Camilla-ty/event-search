import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  needsPartnerAlumniSetCurrent,
  partnerAlumniSetCurrentPrompt,
} from "@/src/features/partner-alumni/lib/partnerAlumniPublishState";
import type { PartnerAlumniAdminData } from "@/src/features/partner-alumni/server/partnerAlumniAdmin";

function sampleData(
  overrides: Partial<PartnerAlumniAdminData> & {
    program?: PartnerAlumniAdminData["program"];
    versions?: PartnerAlumniAdminData["versions"];
  } = {},
): PartnerAlumniAdminData {
  return {
    program: overrides.program ?? null,
    versions: overrides.versions ?? [],
    selected_version: overrides.selected_version ?? null,
  };
}

describe("needsPartnerAlumniSetCurrent", () => {
  it("returns false when a current version is set", () => {
    assert.equal(
      needsPartnerAlumniSetCurrent(
        sampleData({
          program: {
            id: "program-1",
            event_series_id: "series-1",
            current_version_id: "version-current",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          versions: [{ id: "version-current", member_count: 2 } as PartnerAlumniAdminData["versions"][number]],
        }),
      ),
      false,
    );
  });

  it("returns true when versions have members but current_version_id is null", () => {
    assert.equal(
      needsPartnerAlumniSetCurrent(
        sampleData({
          program: {
            id: "program-1",
            event_series_id: "series-1",
            current_version_id: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          versions: [{ id: "version-1", member_count: 1 } as PartnerAlumniAdminData["versions"][number]],
        }),
      ),
      true,
    );
  });

  it("returns false when all versions are empty", () => {
    assert.equal(
      needsPartnerAlumniSetCurrent(
        sampleData({
          program: {
            id: "program-1",
            event_series_id: "series-1",
            current_version_id: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          versions: [{ id: "version-1", member_count: 0 } as PartnerAlumniAdminData["versions"][number]],
        }),
      ),
      false,
    );
  });
});

describe("partnerAlumniSetCurrentPrompt", () => {
  it("returns null when a current version is already set", () => {
    assert.equal(
      partnerAlumniSetCurrentPrompt(
        sampleData({
          program: {
            id: "program-1",
            event_series_id: "series-1",
            current_version_id: "version-current",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        }),
      ),
      null,
    );
  });
});
