import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(relativeFromSrc: string): string {
  return readFileSync(join(root, relativeFromSrc), "utf8");
}

describe("public exhibitor Company Detail history wiring", () => {
  it("loads exhibitor history outside the Sponsor authentication gate", () => {
    const page = readRepo("app/(marketing)/sponsors/[slug]/page.tsx");
    assert.match(page, /getPublicExhibitorHistoryForCompany/);
    assert.match(page, /exhibitorHistoryGroups/);
    assert.match(page, /getSponsorDetailData/);

    // Exhibitor history must not be nested inside getSponsorDetailData's auth-only branch.
    const detailLoader = readRepo("features/sponsors/server/getSponsorDetailData.ts");
    assert.doesNotMatch(detailLoader, /getPublicExhibitorHistoryForCompany/);
    assert.doesNotMatch(detailLoader, /getExhibitorLinksWithEditionsForCompany/);
    assert.doesNotMatch(detailLoader, /event_exhibitors/);

    // Page still 404s when company detail data is missing (restricted / unknown).
    assert.match(page, /notFound\(\)/);
  });

  it("public history loader uses session client and returns empty on failure", () => {
    const source = readRepo("features/exhibitors/server/exhibitorHistoryPublic.ts");
    assert.match(source, /getExhibitorLinksWithEditionsForCompany/);
    assert.match(source, /groupExhibitorHistoryBySeries/);
    assert.match(source, /logExhibitorHistoryLoadFailure/);
    assert.match(source, /return \[\]/);
    assert.doesNotMatch(source, /createAdminClient/);
    assert.doesNotMatch(source, /isAuthenticated/);
    assert.doesNotMatch(source, /Sign in/);

    const query = readRepo("lib/queries/exhibitors.ts");
    assert.match(query, /from\("event_exhibitors"\)/);
    assert.match(query, /EVENT_EDITION_LIST_SELECT/);
    assert.match(query, /createClient/);
    assert.doesNotMatch(query, /createAdminClient/);
  });

  it("renders Exhibitor history below Sponsorship history without a sign-in CTA", () => {
    const view = readRepo("features/sponsors/components/detail/SponsorDetailView.tsx");
    assert.match(view, /ExhibitorHistorySection/);
    assert.match(view, /Sponsorship history/);
    assert.match(view, /exhibitorHistoryGroups/);

    const section = readRepo(
      "features/exhibitors/components/detail/ExhibitorHistorySection.tsx",
    );
    assert.match(section, /Exhibitor history/);
    assert.match(section, /buildEventDetailPath/);
    assert.match(section, /formatLocationFromCityEmbed/);
    assert.match(section, /shouldShowExhibitorHistorySection/);
    assert.match(section, /exhibitorHistoryModel/);
    assert.doesNotMatch(section, /getPublicExhibitorHistoryForCompany/);
    assert.doesNotMatch(section, /getExhibitorLinksWithEditionsForCompany/);
    assert.doesNotMatch(section, /Sign in/);
    assert.doesNotMatch(section, /buildLoginEntryUrl/);
  });
});
