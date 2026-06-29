import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCompanyLogoUpload } from "@/src/lib/companies/companyLogoUploadValidation";

describe("event series logo file upload validation", () => {
  it("accepts PNG uploads within the size limit", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const result = validateCompanyLogoUpload({
      bytes,
      mimeType: "image/png",
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.extension, "png");
    }
  });

  it("rejects unsupported file types", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const result = validateCompanyLogoUpload({
      bytes,
      mimeType: "image/gif",
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
