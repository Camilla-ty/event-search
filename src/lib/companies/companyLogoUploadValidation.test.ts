import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  companyLogoUploadStoragePath,
  MAX_COMPANY_LOGO_SIZE_BYTES,
  validateCompanyLogoUpload,
} from "@/src/lib/companies/companyLogoUploadValidation";
import { selectStaleCompanyLogoCleanupPaths } from "@/src/features/companies/server/companyLogoStorage";

const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("validateCompanyLogoUpload MIME validation", () => {
  it("accepts PNG, JPEG, and WebP", () => {
    const png = validateCompanyLogoUpload({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
    });
    assert.equal(png.ok, true);
    if (png.ok) {
      assert.equal(png.contentType, "image/png");
      assert.equal(png.extension, "png");
    }

    const jpeg = validateCompanyLogoUpload({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
    });
    assert.equal(jpeg.ok, true);
    if (jpeg.ok) assert.equal(jpeg.extension, "jpg");

    const webp = validateCompanyLogoUpload({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/webp",
    });
    assert.equal(webp.ok, true);
    if (webp.ok) assert.equal(webp.extension, "webp");
  });

  it("rejects unsupported MIME types", () => {
    const svg = validateCompanyLogoUpload({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/svg+xml",
    });
    assert.equal(svg.ok, false);
    if (!svg.ok) {
      assert.equal(svg.code, "unsupported_type");
    }
  });
});

describe("validateCompanyLogoUpload file size validation", () => {
  it("rejects files larger than 2 MB", () => {
    const result = validateCompanyLogoUpload({
      bytes: new Uint8Array(MAX_COMPANY_LOGO_SIZE_BYTES + 1),
      mimeType: "image/png",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "file_too_large");
    }
  });

  it("rejects empty files", () => {
    const result = validateCompanyLogoUpload({
      bytes: new Uint8Array(),
      mimeType: "image/png",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "empty_file");
    }
  });
});

describe("companyLogoUploadStoragePath", () => {
  it("builds the canonical companyId-based upload path", () => {
    assert.equal(
      companyLogoUploadStoragePath(COMPANY_ID, "webp"),
      `companies/${COMPANY_ID}/logo.webp`,
    );
  });
});

describe("cleanup candidate selection for manual uploads", () => {
  it("removes sibling logo extensions except the active file", () => {
    const activeStoragePath = `companies/${COMPANY_ID}/logo.webp`;
    const stalePaths = selectStaleCompanyLogoCleanupPaths({
      companyId: COMPANY_ID,
      activeStoragePath,
    });

    assert.ok(stalePaths.includes(`companies/${COMPANY_ID}/logo.png`));
    assert.ok(stalePaths.includes(`companies/${COMPANY_ID}/logo.jpg`));
    assert.ok(stalePaths.includes(`companies/${COMPANY_ID}/logo.jpeg`));
    assert.ok(stalePaths.includes(`companies/${COMPANY_ID}/logo.svg`));
    assert.ok(stalePaths.includes(`companies/${COMPANY_ID}/logo.ico`));
    assert.equal(stalePaths.includes(activeStoragePath), false);
  });
});
