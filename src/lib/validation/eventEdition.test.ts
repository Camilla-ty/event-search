import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateEditionUpdateBody } from "@/src/lib/validation/eventEdition";

describe("validateEditionUpdateBody logo policy", () => {
  it("rejects logo_url updates on event editions", () => {
    const result = validateEditionUpdateBody({
      logo_url: "https://example.com/logo.png",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.errors.join("; "), /logo_url cannot be updated on event editions/i);
  });
});
