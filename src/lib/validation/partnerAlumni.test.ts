import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeMoveOrderedMemberIds,
  validateDraftMemberReorderIds,
} from "@/src/features/partner-alumni/server/partnerAlumniReorder";
import {
  validatePartnerAlumniCreateMemberBody,
  validatePartnerAlumniCreateVersionBody,
  validatePartnerAlumniHeaderPatchBody,
  validatePartnerAlumniMoveMemberBody,
  validatePartnerAlumniVersionHeaderPatchBody,
} from "@/src/lib/validation/partnerAlumni";

describe("validatePartnerAlumniHeaderPatchBody", () => {
  it("accepts recognition_label and primary_source_url", () => {
    const result = validatePartnerAlumniHeaderPatchBody({
      recognition_label: "Our Partners Over The Years",
      primary_source_url: "https://example.com/partners",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.patch.recognition_label, "Our Partners Over The Years");
      assert.equal(result.patch.primary_source_url, "https://example.com/partners");
    }
  });

  it("rejects empty patch", () => {
    const result = validatePartnerAlumniHeaderPatchBody({});
    assert.equal(result.ok, false);
  });
});

describe("validatePartnerAlumniVersionHeaderPatchBody", () => {
  it("accepts version header fields", () => {
    const result = validatePartnerAlumniVersionHeaderPatchBody({
      version_label: "2026 refresh",
      recognition_label: "Partners",
      primary_source_url: "https://example.com/partners",
      source_checked_at: "2026-07-01",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.patch.version_label, "2026 refresh");
      assert.equal(result.patch.source_checked_at, "2026-07-01T00:00:00.000Z");
    }
  });
});

describe("validatePartnerAlumniCreateVersionBody", () => {
  it("defaults to copy mode", () => {
    const result = validatePartnerAlumniCreateVersionBody({});
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.mode, "copy");
  });

  it("accepts empty mode", () => {
    const result = validatePartnerAlumniCreateVersionBody({ mode: "empty" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.mode, "empty");
  });

  it("rejects invalid mode", () => {
    const result = validatePartnerAlumniCreateVersionBody({ mode: "invalid" });
    assert.equal(result.ok, false);
  });
});

describe("validatePartnerAlumniCreateMemberBody", () => {
  it("requires a valid company_id UUID", () => {
    const result = validatePartnerAlumniCreateMemberBody({
      company_id: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(result.ok, true);
  });

  it("rejects invalid company_id", () => {
    const result = validatePartnerAlumniCreateMemberBody({ company_id: "bad" });
    assert.equal(result.ok, false);
  });
});

describe("validatePartnerAlumniMoveMemberBody", () => {
  it("accepts member_id and direction", () => {
    const result = validatePartnerAlumniMoveMemberBody({
      member_id: "11111111-1111-4111-8111-111111111111",
      direction: "up",
    });
    assert.equal(result.ok, true);
  });
});

describe("partnerAlumniReorder helpers", () => {
  it("validates complete reorder permutations", () => {
    const result = validateDraftMemberReorderIds(
      ["a", "b"],
      ["a", "b"],
    );
    assert.equal(result.ok, true);
  });

  it("rejects incomplete reorder permutations", () => {
    const result = validateDraftMemberReorderIds(["a"], ["a", "b"]);
    assert.equal(result.ok, false);
  });

  it("computes move up order", () => {
    const next = computeMoveOrderedMemberIds(["a", "b", "c"], "b", "up");
    assert.deepEqual(next, ["b", "a", "c"]);
  });
});
