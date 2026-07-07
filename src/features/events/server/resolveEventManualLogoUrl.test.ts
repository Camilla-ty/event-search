import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveEventManualLogoUrl } from "./resolveEventManualLogoUrl";

const SERIES_ID = "00000000-0000-4000-8000-000000000001";
const LOGO_PATH = `event-series/${SERIES_ID}/logo.jpg`;

describe("resolveEventManualLogoUrl", () => {
  it("no-ops when save resubmits an unchanged owned bucket-relative logo path", async () => {
    const result = await resolveEventManualLogoUrl({
      incomingLogoUrl: LOGO_PATH,
      existingLogoUrl: LOGO_PATH,
      seriesId: SERIES_ID,
    });

    assert.deepEqual(result, {
      ok: true,
      logo_url: LOGO_PATH,
      applyPatch: false,
    });
  });

  it("does not treat an unchanged owned bucket-relative logo as an external import URL", async () => {
    const result = await resolveEventManualLogoUrl({
      incomingLogoUrl: LOGO_PATH,
      existingLogoUrl: LOGO_PATH,
      seriesId: SERIES_ID,
    });

    assert.notEqual(result.ok, false);
    if (!result.ok) {
      assert.fail("expected save to succeed without import warning");
    }
  });
});
