import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isCompanyRestricted,
  RESTRICTED_COMPANY_PUBLIC_MESSAGE,
} from "./companyPublicRestriction";

describe("companyPublicRestriction", () => {
  it("detects restricted companies by restricted_at", () => {
    assert.equal(isCompanyRestricted({ restricted_at: null }), false);
    assert.equal(isCompanyRestricted({ restricted_at: undefined }), false);
    assert.equal(isCompanyRestricted(null), false);
    assert.equal(isCompanyRestricted({ restricted_at: "2026-07-11T00:00:00.000Z" }), true);
  });

  it("uses the approved public policy message", () => {
    assert.equal(
      RESTRICTED_COMPANY_PUBLIC_MESSAGE,
      "This company is not publicly displayed in accordance with EventPixels' content policy.",
    );
  });
});
