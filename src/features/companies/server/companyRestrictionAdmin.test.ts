import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MERGED_COMPANY_CANNOT_BE_RESTRICTED_MESSAGE,
} from "./companyRestrictionAdmin";

describe("companyRestrictionAdmin messages", () => {
  it("documents merged restriction guard copy", () => {
    assert.equal(
      MERGED_COMPANY_CANNOT_BE_RESTRICTED_MESSAGE,
      "Merged companies cannot be restricted.",
    );
  });
});
