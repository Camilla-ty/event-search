import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPartnerAlumniVerifiedMonth } from "@/src/features/partner-alumni/lib/formatPartnerAlumniVerifiedMonth";

describe("formatPartnerAlumniVerifiedMonth", () => {
  it("formats ISO timestamps as month and year", () => {
    assert.equal(
      formatPartnerAlumniVerifiedMonth("2026-07-15T12:00:00.000Z"),
      "July 2026",
    );
  });
});
