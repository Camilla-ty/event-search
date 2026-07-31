import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCompanyLogoUpload } from "@/src/lib/companies/companyLogoUploadValidation";

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("event series logo file upload validation", () => {
  it("accepts PNG uploads within the size limit", () => {
    const result = validateCompanyLogoUpload({
      bytes: PNG_BYTES,
      mimeType: "image/png",
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.extension, "png");
    }
  });

  it("rejects GIF bytes even with a PNG MIME claim", () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const result = validateCompanyLogoUpload({
      bytes,
      mimeType: "image/png",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_type");
    }
  });

  it("rejects files larger than 2 MB", () => {
    const bytes = new Uint8Array(2 * 1024 * 1024 + 1);
    const result = validateCompanyLogoUpload({
      bytes,
      mimeType: "image/png",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "file_too_large");
    }
  });
});
