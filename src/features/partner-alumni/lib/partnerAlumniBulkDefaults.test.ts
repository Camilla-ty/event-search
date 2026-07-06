import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPartnerAlumniBulkCommitPayloadRow,
  getDefaultPartnerAlumniBulkRowDecision,
  shouldCreateCompanyOnPartnerAlumniBulkImport,
  shouldPartnerAlumniBulkImportByDefault,
} from "@/src/features/partner-alumni/lib/partnerAlumniBulkDefaults";
import type { PartnerAlumniBulkPreviewRow } from "@/src/features/partner-alumni/server/partnerAlumniBulkImport";
import {
  validatePartnerAlumniBulkCommitBody,
  validatePartnerAlumniBulkPreviewBody,
} from "@/src/lib/validation/partnerAlumniBulk";

function previewRow(
  overrides: Partial<PartnerAlumniBulkPreviewRow> & Pick<PartnerAlumniBulkPreviewRow, "status">,
): PartnerAlumniBulkPreviewRow {
  return {
    row_number: 2,
    name: "Acme Corp",
    website: "https://acme.com",
    display_order: 1,
    match_method: null,
    proposed_company_id: null,
    proposed_company_name: null,
    conflict_type: null,
    message: null,
    ...overrides,
  };
}

describe("getDefaultPartnerAlumniBulkRowDecision", () => {
  it("selects create_new rows for import by default", () => {
    const decision = getDefaultPartnerAlumniBulkRowDecision(
      previewRow({ status: "create_new" }),
    );
    assert.equal(decision.action, "import");
    assert.equal(decision.create_new, true);
    assert.equal(decision.company_id, null);
  });

  it("selects matched rows for import by default", () => {
    const decision = getDefaultPartnerAlumniBulkRowDecision(
      previewRow({
        status: "matched",
        proposed_company_id: "11111111-1111-1111-1111-111111111111",
      }),
    );
    assert.equal(decision.action, "import");
    assert.equal(decision.company_id, "11111111-1111-1111-1111-111111111111");
  });

  it("skips review rows by default", () => {
    const decision = getDefaultPartnerAlumniBulkRowDecision(
      previewRow({
        status: "review",
        proposed_company_id: "11111111-1111-1111-1111-111111111111",
      }),
    );
    assert.equal(decision.action, "skip");
  });

  it("skips on_roster and duplicate rows by default", () => {
    assert.equal(
      getDefaultPartnerAlumniBulkRowDecision(previewRow({ status: "on_roster" })).action,
      "skip",
    );
    assert.equal(
      getDefaultPartnerAlumniBulkRowDecision(previewRow({ status: "duplicate_in_file" })).action,
      "skip",
    );
  });
});

describe("buildPartnerAlumniBulkCommitPayloadRow", () => {
  it("includes create_new for create_new preview rows", () => {
    const payload = buildPartnerAlumniBulkCommitPayloadRow(
      previewRow({ status: "create_new" }),
      getDefaultPartnerAlumniBulkRowDecision(previewRow({ status: "create_new" })),
    );
    assert.equal(payload.action, "import");
    assert.equal(payload.create_new, true);
    assert.equal(payload.company_id, null);
  });
});

describe("shouldCreateCompanyOnPartnerAlumniBulkImport", () => {
  it("creates when import row has no company_id", () => {
    assert.equal(
      shouldCreateCompanyOnPartnerAlumniBulkImport({
        action: "import",
      }),
      true,
    );
  });

  it("does not create when company_id is provided", () => {
    assert.equal(
      shouldCreateCompanyOnPartnerAlumniBulkImport({
        action: "import",
        company_id: "11111111-1111-1111-1111-111111111111",
      }),
      false,
    );
  });
});

describe("shouldPartnerAlumniBulkImportByDefault", () => {
  it("returns true only for matched and create_new", () => {
    assert.equal(shouldPartnerAlumniBulkImportByDefault("matched"), true);
    assert.equal(shouldPartnerAlumniBulkImportByDefault("create_new"), true);
    assert.equal(shouldPartnerAlumniBulkImportByDefault("review"), false);
    assert.equal(shouldPartnerAlumniBulkImportByDefault("on_roster"), false);
  });
});

describe("validatePartnerAlumniBulkPreviewBody", () => {
  it("accepts valid rows", () => {
    const result = validatePartnerAlumniBulkPreviewBody({
      rows: [{ row_number: 2, name: "Acme", website: "https://acme.com", display_order: 1 }],
    });
    assert.equal(result.ok, true);
  });

  it("rejects empty rows array", () => {
    const result = validatePartnerAlumniBulkPreviewBody({ rows: [] });
    assert.equal(result.ok, false);
  });
});

describe("validatePartnerAlumniBulkCommitBody", () => {
  it("accepts import rows without company_id for implicit create", () => {
    const result = validatePartnerAlumniBulkCommitBody({
      rows: [{ row_number: 2, name: "Acme", action: "import" }],
    });
    assert.equal(result.ok, true);
  });

  it("accepts create_new import rows", () => {
    const result = validatePartnerAlumniBulkCommitBody({
      rows: [
        {
          row_number: 2,
          name: "Acme",
          action: "import",
          create_new: true,
        },
      ],
    });
    assert.equal(result.ok, true);
  });
});
