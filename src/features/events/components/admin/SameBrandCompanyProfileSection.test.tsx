import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const sectionPath = join(
  process.cwd(),
  "src/features/events/components/admin/SameBrandCompanyProfileSection.tsx",
);

describe("SameBrandCompanyProfileSection wiring (SB1/SB3)", () => {
  const source = readFileSync(sectionPath, "utf8");

  it("supports link, replace, unlink, and stale-link messaging", () => {
    assert.match(source, /Same-brand company profile/);
    assert.match(source, /not an organizer, owner, or operator/i);
    assert.match(source, /persistCompanyProfileId\(selectedCompany\.id,\s*action\)/);
    assert.match(source, /persistCompanyProfileId\(null,\s*"unlink"\)/);
    assert.match(source, /SAME_BRAND_STALE_LINK_MESSAGE/);
    assert.match(source, /isSameBrandCompanyProfileStale/);
    assert.match(source, /This event series is merged/);
    assert.match(source, /company_profile_id:\s*nextId/);
  });

  it("surfaces restricted-company admin warning without calling it ownership", () => {
    assert.match(source, /isCompanyRestrictedForSameBrand/);
    assert.match(source, /restricted from public profiles/);
    assert.doesNotMatch(source, /organizer of this series/i);
  });
});
