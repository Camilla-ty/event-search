import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const routePath = join(
  process.cwd(),
  "src/app/api/admin/event-series/[id]/route.ts",
);

describe("event-series PATCH same-brand company_profile_id wiring", () => {
  const source = readFileSync(routePath, "utf8");

  it("accepts company_profile_id on the series update path with validation", () => {
    assert.match(source, /company_profile_id\?: string \| null/);
    assert.match(source, /validateSameBrandCompanyProfileAssignment/);
    assert.match(source, /getCompanyForSameBrandLinkAdmin/);
    assert.match(source, /findSeriesByCompanyProfileIdAdmin/);
    assert.match(source, /patch\.company_profile_id = null/);
    assert.match(source, /patch\.company_profile_id = companyProfileId/);
  });

  it("surfaces restricted-company warnings from validation", () => {
    assert.match(source, /warnings\.push\(\.\.\.validation\.warnings\)/);
  });
});
