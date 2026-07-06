import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergePartnerAlumniDisplayOrder } from "@/src/features/partner-alumni/lib/partnerAlumniMergeDedupe";

describe("mergePartnerAlumniDisplayOrder", () => {
  it("keeps canonical order when it is lower", () => {
    assert.equal(mergePartnerAlumniDisplayOrder(2, 5), 2);
  });

  it("adopts duplicate order when it is lower", () => {
    assert.equal(mergePartnerAlumniDisplayOrder(8, 3), 3);
  });

  it("returns either order when equal", () => {
    assert.equal(mergePartnerAlumniDisplayOrder(4, 4), 4);
  });
});
