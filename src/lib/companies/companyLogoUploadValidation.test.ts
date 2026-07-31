import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectLogoRasterFormat,
  looksLikeRejectedMarkup,
  MAX_LOGO_BINARY_BYTES,
  validateLogoBinary,
} from "@/src/lib/companies/logoBinaryValidation";
import {
  companyLogoUploadStoragePath,
  MAX_COMPANY_LOGO_SIZE_BYTES,
  validateCompanyLogoUpload,
} from "@/src/lib/companies/companyLogoUploadValidation";
import { selectStaleCompanyLogoCleanupPaths } from "@/src/features/companies/server/companyLogoStorage";

const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const ICO_BYTES = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]);
const SVG_BYTES = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
);
const HTML_BYTES = new TextEncoder().encode("<!DOCTYPE html><html></html>");
const XML_BYTES = new TextEncoder().encode('<?xml version="1.0"?><root/>');

describe("validateLogoBinary magic-byte validation", () => {
  it("accepts PNG, JPEG, and WebP fixtures", () => {
    const png = validateLogoBinary(PNG_BYTES);
    assert.equal(png.ok, true);
    if (png.ok) {
      assert.equal(png.contentType, "image/png");
      assert.equal(png.extension, "png");
    }

    const jpeg = validateLogoBinary(JPEG_BYTES);
    assert.equal(jpeg.ok, true);
    if (jpeg.ok) {
      assert.equal(jpeg.contentType, "image/jpeg");
      assert.equal(jpeg.extension, "jpg");
    }

    const webp = validateLogoBinary(WEBP_BYTES);
    assert.equal(webp.ok, true);
    if (webp.ok) {
      assert.equal(webp.contentType, "image/webp");
      assert.equal(webp.extension, "webp");
    }
  });

  it("rejects SVG even when declared as PNG", () => {
    const result = validateCompanyLogoUpload({
      bytes: SVG_BYTES,
      mimeType: "image/png",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unsupported_type");
  });

  it("rejects GIF, ICO, HTML, and XML", () => {
    for (const bytes of [GIF_BYTES, ICO_BYTES, HTML_BYTES, XML_BYTES, SVG_BYTES]) {
      const result = validateLogoBinary(bytes);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "unsupported_type");
    }
  });

  it("rejects empty and oversized payloads", () => {
    assert.equal(validateLogoBinary(new Uint8Array()).ok, false);
    assert.equal(
      validateLogoBinary(new Uint8Array(MAX_LOGO_BINARY_BYTES + 1)).ok,
      false,
    );
  });

  it("detectLogoRasterFormat returns null for unknown bytes", () => {
    assert.equal(detectLogoRasterFormat(new Uint8Array([1, 2, 3, 4])), null);
    assert.equal(looksLikeRejectedMarkup(SVG_BYTES), true);
  });
});

describe("validateCompanyLogoUpload delegates to binary validation", () => {
  it("accepts valid raster bytes regardless of declared MIME", () => {
    const result = validateCompanyLogoUpload({
      bytes: PNG_BYTES,
      mimeType: "application/octet-stream",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.extension, "png");
  });

  it("rejects files larger than 2 MB", () => {
    const result = validateCompanyLogoUpload({
      bytes: new Uint8Array(MAX_COMPANY_LOGO_SIZE_BYTES + 1),
      mimeType: "image/png",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "file_too_large");
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
