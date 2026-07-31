import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const routePath = join(
  process.cwd(),
  "src/app/api/admin/event-series/[id]/route.ts",
);

describe("event-series PATCH same-brand wiring", () => {
  const source = readFileSync(routePath, "utf8");

  it("persists company_profile_id through the series update path with validation", () => {
    assert.match(source, /company_profile_id/);
    assert.match(source, /resolveSameBrandCompanyProfilePatch/);
    assert.match(source, /findSeriesByCompanyProfileId/);
    assert.match(source, /getCompanyAdminById/);
    assert.match(source, /updateEventSeries/);
    assert.match(source, /event_series_company_profile_id_key/);
  });
});
