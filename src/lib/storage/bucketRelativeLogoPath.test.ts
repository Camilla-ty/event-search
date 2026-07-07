import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bucketRelativePathFromLogoReference } from "./bucketRelativeLogoPath";

const SERIES_ID = "00000000-0000-4000-8000-000000000001";

describe("bucketRelativePathFromLogoReference", () => {
  it("returns bucket-relative paths unchanged", () => {
    const path = `event-series/${SERIES_ID}/logo.jpg`;
    assert.equal(bucketRelativePathFromLogoReference(path), path);
  });

  it("extracts bucket-relative paths from full public URLs", () => {
    const path = `companies/${SERIES_ID}/logo.png`;
    assert.equal(
      bucketRelativePathFromLogoReference(
        `https://example.supabase.co/storage/v1/object/public/company-logos/${path}`,
      ),
      path,
    );
  });
});
