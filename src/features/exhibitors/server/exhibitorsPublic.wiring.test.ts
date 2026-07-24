import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(relativeFromSrc: string): string {
  return readFileSync(join(root, relativeFromSrc), "utf8");
}

describe("public exhibitors Event Detail wiring", () => {
  it("loads exhibitors fail-soft and redirects hidden exhibitors deep links", () => {
    const page = readRepo("app/(marketing)/events/[id]/page.tsx");
    assert.match(page, /getPublicExhibitorsForEditionId/);
    assert.match(page, /shouldShowPublicExhibitorsTab/);
    assert.match(page, /requestedTab === "exhibitors" && !showExhibitorsTab/);
    assert.match(page, /redirect\(`\/events\/\$\{eventSlug \|\| id\}`\)/);
  });

  it("public loader uses session client and returns empty on failure", () => {
    const source = readRepo("features/exhibitors/server/exhibitorsPublic.ts");
    assert.match(source, /createClient/);
    assert.match(source, /getCompaniesByIds/);
    assert.match(source, /from\("event_exhibitors"\)/);
    assert.match(source, /logPublicExhibitorLoadFailure/);
    assert.match(source, /return \[\]/);
    assert.doesNotMatch(source, /createAdminClient/);
    assert.doesNotMatch(source, /mergeCompaniesOntoEventSponsorLinks/);
    assert.doesNotMatch(source, /\/api\/events\/.*\/sponsors/);
    assert.doesNotMatch(source, /PUBLIC_SPONSOR_TIER_PAGE_SIZE/);
  });
});
