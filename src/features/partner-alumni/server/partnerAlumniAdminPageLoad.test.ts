import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_PARTNER_ALUMNI_ADMIN_DATA,
  formatPartnerAlumniLoadError,
  resolvePartnerAlumniAdminPageLoad,
} from "@/src/features/partner-alumni/server/partnerAlumniAdminPageLoad";

describe("formatPartnerAlumniLoadError", () => {
  it("uses Error.message when present", () => {
    assert.equal(formatPartnerAlumniLoadError(new Error("TypeError: fetch failed")), "TypeError: fetch failed");
  });

  it("falls back to a generic message", () => {
    assert.equal(formatPartnerAlumniLoadError(null), "Could not load Partner Alumni data.");
  });
});

describe("resolvePartnerAlumniAdminPageLoad", () => {
  it("returns data when the loader succeeds", async () => {
    const payload = {
      program: null,
      versions: [],
      selected_version: null,
    };

    const result = await resolvePartnerAlumniAdminPageLoad(async () => payload);

    assert.deepEqual(result, { data: payload, loadError: null });
  });

  it("returns empty data and loadError when the loader throws fetch failed", async () => {
    const result = await resolvePartnerAlumniAdminPageLoad(async () => {
      throw new Error("TypeError: fetch failed");
    });

    assert.deepEqual(result.data, EMPTY_PARTNER_ALUMNI_ADMIN_DATA);
    assert.equal(result.loadError, "TypeError: fetch failed");
  });
});
