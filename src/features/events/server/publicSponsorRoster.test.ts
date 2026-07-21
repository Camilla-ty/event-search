import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  PUBLIC_SPONSOR_TIER_PAGE_SIZE,
  buildPublicSponsorTierSummariesFromLinks,
  clampPublicSponsorTierPageSize,
  countTiersFromPublicSponsorSummaries,
} from "@/src/features/events/server/publicSponsorRoster";
import { publicTierSectionTitle } from "@/src/features/events/lib/groupSponsorsByTier";

describe("publicSponsorRoster Phase 1 helpers", () => {
  it("hard-caps page size at 20 regardless of client input", () => {
    assert.equal(PUBLIC_SPONSOR_TIER_PAGE_SIZE, 20);
    assert.equal(clampPublicSponsorTierPageSize(), 20);
    assert.equal(clampPublicSponsorTierPageSize(1), 20);
    assert.equal(clampPublicSponsorTierPageSize(100), 20);
    assert.equal(clampPublicSponsorTierPageSize(9999), 20);
    assert.equal(clampPublicSponsorTierPageSize(null), 20);
  });

  it("builds identity-free summaries with locked flags for anonymous viewers", () => {
    const summary = buildPublicSponsorTierSummariesFromLinks(
      "edition-1",
      [
        { tier_rank: 1, tier_label: "Gold" },
        { tier_rank: 1, tier_label: "Gold" },
        { tier_rank: 2, tier_label: "Silver" },
        { tier_rank: 2, tier_label: null },
        { tier_rank: 3, tier_label: "Bronze" },
        { tier_rank: null, tier_label: null },
      ],
      { isAuthenticated: false, totalSponsorCount: 99 },
    );

    assert.equal(summary.editionId, "edition-1");
    assert.equal(summary.totalSponsorCount, 99);
    assert.equal(countTiersFromPublicSponsorSummaries(summary), 3);
    assert.deepEqual(
      summary.tiers.map((tier) => ({
        tierRank: tier.tierRank,
        tierLabel: tier.tierLabel,
        count: tier.count,
        locked: tier.locked,
      })),
      [
        { tierRank: 1, tierLabel: "Gold", count: 2, locked: false },
        { tierRank: 2, tierLabel: "Silver", count: 2, locked: true },
        { tierRank: 3, tierLabel: "Bronze", count: 1, locked: true },
        { tierRank: null, tierLabel: null, count: 1, locked: true },
      ],
    );

    for (const tier of summary.tiers) {
      assert.equal("company_id" in tier, false);
      assert.equal("name" in tier, false);
      assert.equal("slug" in tier, false);
      assert.equal("domain" in tier, false);
    }
  });

  it("does not lock Tier 2+ summaries for authenticated viewers", () => {
    const summary = buildPublicSponsorTierSummariesFromLinks(
      "edition-1",
      [
        { tier_rank: 1, tier_label: "Gold" },
        { tier_rank: 2, tier_label: "Silver" },
      ],
      { isAuthenticated: true },
    );

    assert.equal(summary.tiers[0]?.locked, false);
    assert.equal(summary.tiers[1]?.locked, false);
  });

  it("keeps the full tier count while only page-one rows are rendered", () => {
    const group = {
      tierRank: 1,
      tierLabel: "Gold",
      sponsors: Array.from({ length: 20 }, (_, index) => ({
        id: `sponsor-${index}`,
      })),
    };

    assert.equal(publicTierSectionTitle(group, 25), "Gold · 25 sponsors");
  });
});

describe("Phase 1 SSR wiring contracts", () => {
  it("getEventDetailData no longer loads the full event_sponsors roster", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/events/server/getEventDetailData.ts"),
      "utf8",
    );

    assert.doesNotMatch(source, /getCompaniesByEventEdition/);
    assert.doesNotMatch(source, /event_sponsors/);
  });

  it("event detail page loads Tier 1 page 1 and summaries instead of the full roster", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/events/[id]/page.tsx"),
      "utf8",
    );

    assert.match(source, /getPublicSponsorTierSummaries/);
    assert.match(source, /getInitialPublicSponsorTierOnePage/);
    assert.doesNotMatch(source, /getCompaniesByEventEdition/);
    assert.doesNotMatch(source, /edition\.event_sponsors/);
    assert.doesNotMatch(source, /countDistinctSponsorshipTiers/);
    assert.match(source, /countTiersFromPublicSponsorSummaries/);
  });

  it("serializes identity-free summaries and the Tier 1 page into Sponsors props", () => {
    const pageSource = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/events/[id]/page.tsx"),
      "utf8",
    );
    const sectionSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/detail/EventSponsorsSection.tsx",
      ),
      "utf8",
    );

    assert.match(pageSource, /tierSummaries=\{sponsorTierSummaries\}/);
    assert.match(pageSource, /initialTier1Page=\{tier1PageResult\}/);
    assert.match(sectionSource, /tierSummaries:\s*PublicSponsorTierSummary/);
    assert.match(sectionSource, /initialTier1Page:\s*PublicSponsorTierPageResult/);
    assert.match(sectionSource, /initialTier1Page\.rows/);
    assert.doesNotMatch(sectionSource, /sponsors:\s*EventSponsorRow\[\]/);
  });

  it("metadata path does not depend on sponsor company identities", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/events/[id]/page.tsx"),
      "utf8",
    );

    const metadataBlock = source.slice(
      source.indexOf("export async function generateMetadata"),
      source.indexOf("export default async function EventDetailPage"),
    );

    assert.match(metadataBlock, /getTotalSponsorCount/);
    assert.doesNotMatch(metadataBlock, /event_sponsors/);
    assert.doesNotMatch(metadataBlock, /companies/);
    assert.doesNotMatch(metadataBlock, /tier_rank:\s*2/);
  });
});
