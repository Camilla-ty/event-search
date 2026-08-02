import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildPublicSponsorTierSummariesFromAggregates,
  buildPublicSponsorTierSummariesFromLinks,
} from "@/src/features/events/server/publicSponsorRoster";

const rosterSourcePath = path.join(
  process.cwd(),
  "src/features/events/server/publicSponsorRoster.ts",
);
const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260802120000_event_edition_sponsor_public_aggregates.sql",
);

describe("ARC-001 Phase 2 public sponsor tier summaries", () => {
  it("getPublicSponsorTierSummaries uses the public aggregate view without admin", () => {
    const source = readFileSync(rosterSourcePath, "utf8");
    const marker = "export async function getPublicSponsorTierSummaries";
    const start = source.indexOf(marker);
    assert.ok(start >= 0);
    const nextExport = source.indexOf("\nexport ", start + 1);
    const body = source.slice(start, nextExport > start ? nextExport : source.length);

    assert.match(body, /createClient/);
    assert.match(body, /event_edition_sponsor_tier_stats/);
    assert.doesNotMatch(body, /createAdminClient/);
    assert.doesNotMatch(body, /\.from\("event_sponsors"\)/);
    assert.doesNotMatch(body, /company_id/);
  });

  it("migration exposes identity-free aggregates only (no company columns)", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const selectBodies = [...sql.matchAll(/AS\s*\nSELECT([\s\S]*?)FROM public\.event_sponsors/g)].map(
      (match) => match[1] ?? "",
    );
    assert.equal(selectBodies.length, 2);
    assert.match(sql, /event_edition_sponsor_counts/);
    assert.match(sql, /event_edition_sponsor_tier_stats/);
    assert.match(sql, /security_invoker\s*=\s*false/i);
    assert.match(sql, /REVOKE ALL ON public\.event_edition_sponsor_counts FROM PUBLIC, anon, authenticated/);
    assert.match(sql, /GRANT SELECT ON public\.event_edition_sponsor_counts TO anon, authenticated/);
    assert.match(
      sql,
      /REVOKE ALL ON public\.event_edition_sponsor_tier_stats FROM PUBLIC, anon, authenticated/,
    );
    assert.match(
      sql,
      /GRANT SELECT ON public\.event_edition_sponsor_tier_stats TO anon, authenticated/,
    );
    for (const body of selectBodies) {
      assert.doesNotMatch(body, /\bcompany_id\b/);
      assert.doesNotMatch(body, /\blogo_url\b/);
      assert.doesNotMatch(body, /\bname\b/);
      assert.doesNotMatch(body, /\bslug\b/);
      assert.doesNotMatch(body, /\bdomain\b/);
    }
  });

  it("anonymous viewers get locked Tier 2+ chrome without company identities", () => {
    const summary = buildPublicSponsorTierSummariesFromAggregates(
      "edition-1",
      [
        { tier_rank: 1, tier_label: "Gold", sponsor_count: 2 },
        { tier_rank: 2, tier_label: "Silver", sponsor_count: 5 },
        { tier_rank: 3, tier_label: "Bronze", sponsor_count: 1 },
      ],
      { isAuthenticated: false, totalSponsorCount: 8 },
    );

    assert.equal(summary.totalSponsorCount, 8);
    assert.deepEqual(
      summary.tiers.map((tier) => ({
        tierRank: tier.tierRank,
        count: tier.count,
        locked: tier.locked,
      })),
      [
        { tierRank: 1, count: 2, locked: false },
        { tierRank: 2, count: 5, locked: true },
        { tierRank: 3, count: 1, locked: true },
      ],
    );

    for (const tier of summary.tiers) {
      assert.equal("company_id" in tier, false);
      assert.equal("name" in tier, false);
      assert.equal("slug" in tier, false);
      assert.equal("domain" in tier, false);
      assert.equal("logo_url" in tier, false);
    }
  });

  it("preserves existing public link-based summary behaviour", () => {
    const fromLinks = buildPublicSponsorTierSummariesFromLinks(
      "edition-1",
      [
        { tier_rank: 1, tier_label: "Gold" },
        { tier_rank: 1, tier_label: "Gold" },
        { tier_rank: 2, tier_label: "Silver" },
      ],
      { isAuthenticated: true },
    );
    const fromAggregates = buildPublicSponsorTierSummariesFromAggregates(
      "edition-1",
      [
        { tier_rank: 1, tier_label: "Gold", sponsor_count: 2 },
        { tier_rank: 2, tier_label: "Silver", sponsor_count: 1 },
      ],
      { isAuthenticated: true },
    );

    assert.deepEqual(fromLinks, fromAggregates);
    assert.equal(fromLinks.tiers.every((tier) => tier.locked === false), true);
  });
});
