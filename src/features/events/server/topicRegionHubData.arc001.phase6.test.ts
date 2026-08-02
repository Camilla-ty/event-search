import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { readSeriesIdsFromKeywordLinks } from "@/src/features/events/server/topicHubPublic";
import {
  mapPublishedResearchPageRows,
} from "@/src/features/research-pages/server/researchPagesPublic";
import { formatResearchPagePublicPath } from "@/src/features/research-pages/lib/formatResearchPagePublicPath";

const hubSourcePath = join(
  process.cwd(),
  "src/features/events/server/topicRegionHubData.ts",
);
const researchPublicPath = join(
  process.cwd(),
  "src/features/research-pages/server/researchPagesPublic.ts",
);
const sitemapPath = join(process.cwd(), "src/lib/seo/sitemapEntries.ts");
const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260802160000_topic_region_hub_public_reads.sql",
);
const allYearsPagePath = join(
  process.cwd(),
  "src/app/(marketing)/events/topics/[topicSlug]/regions/[regionSlug]/page.tsx",
);
const yearPagePath = join(
  process.cwd(),
  "src/app/(marketing)/events/topics/[topicSlug]/regions/[regionSlug]/years/[year]/page.tsx",
);

describe("topicRegionHubData wiring (ARC-001 Phase 6)", () => {
  it("Topic / Region Hub loaders no longer use createAdminClient", () => {
    const source = readFileSync(hubSourcePath, "utf8");
    assert.match(source, /createClient/);
    assert.match(source, /event_edition_sponsor_companies/);
    assert.match(source, /getSponsorCountsByEditionIds/);
    assert.match(source, /\.is\("restricted_at", null\)/);
    assert.doesNotMatch(source, /createAdminClient/);
    assert.doesNotMatch(source, /from "@\/src\/lib\/supabase\/admin"/);
    assert.doesNotMatch(source, /\.from\("event_sponsors"\)/);
  });

  it("fails if createAdminClient is reintroduced into public hub helpers", () => {
    for (const path of [hubSourcePath, researchPublicPath, sitemapPath]) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(
        source,
        /createAdminClient/,
        `unexpected createAdminClient in ${path}`,
      );
    }

    const researchPublic = readFileSync(researchPublicPath, "utf8");
    assert.match(researchPublic, /topic_region_research_pages_published/);
    assert.match(researchPublic, /getPublishedResearchPageBySlugsPublic/);
    assert.match(researchPublic, /listPublishedResearchPagesPublic/);
  });

  it("year-scoped and all-years routes still call getTopicRegionHubPageData", () => {
    const allYears = readFileSync(allYearsPagePath, "utf8");
    const yearScoped = readFileSync(yearPagePath, "utf8");
    assert.match(allYears, /getTopicRegionHubPageData/);
    assert.match(allYears, /getPublishedResearchPageBySlugsPublic/);
    assert.doesNotMatch(allYears, /researchPageAdmin/);
    assert.match(yearScoped, /getTopicRegionHubPageData/);
    assert.match(yearScoped, /getPublishedResearchPageBySlugsPublic/);
    assert.match(yearScoped, /parseResearchPageYearParam/);
    assert.doesNotMatch(yearScoped, /researchPageAdmin/);
  });

  it("sitemap research entries use published public pages + hub gate", () => {
    const source = readFileSync(sitemapPath, "utf8");
    assert.match(source, /listPublishedResearchPagesPublic/);
    assert.match(source, /getTopicRegionHubPageData/);
    assert.match(source, /passesGate/);
    assert.doesNotMatch(source, /listResearchPagesAdmin/);
  });

  it("migration exposes narrow public views with SELECT grants", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /event_edition_sponsor_companies/);
    assert.match(sql, /topic_region_research_pages_published/);
    assert.match(sql, /security_invoker\s*=\s*false/i);
    assert.match(sql, /status = 'published'/);
    assert.match(
      sql,
      /REVOKE ALL ON public\.event_edition_sponsor_companies FROM PUBLIC, anon, authenticated/,
    );
    assert.match(
      sql,
      /GRANT SELECT ON public\.event_edition_sponsor_companies TO anon, authenticated/,
    );
    assert.match(
      sql,
      /REVOKE ALL ON public\.topic_region_research_pages_published FROM PUBLIC, anon, authenticated/,
    );
    assert.match(
      sql,
      /GRANT SELECT ON public\.topic_region_research_pages_published TO anon, authenticated/,
    );

    const sponsorSelect =
      sql.match(
        /event_edition_sponsor_companies[\s\S]*?AS\s*\nSELECT([\s\S]*?)FROM public\.event_sponsors/,
      )?.[1] ?? "";
    assert.match(sponsorSelect, /event_editions_id/);
    assert.match(sponsorSelect, /company_id/);
    assert.doesNotMatch(sponsorSelect, /tier_rank/);
    assert.doesNotMatch(sponsorSelect, /tier_label/);
    assert.doesNotMatch(sponsorSelect, /\bname\b/);
    assert.doesNotMatch(sponsorSelect, /\bslug\b/);
  });
});

describe("hub public helpers preserve output contracts", () => {
  it("keeps published research page mapping shape for sitemap inputs", () => {
    const pages = mapPublishedResearchPageRows([
      {
        id: "page-1",
        year: 2026,
        published_at: "2026-07-01T00:00:00.000Z",
        topic_name: "Bitcoin",
        topic_slug: "bitcoin",
        region_name: "Asia",
        region_slug: "asia",
      },
      {
        id: "page-all",
        year: null,
        published_at: "2026-06-01T00:00:00.000Z",
        topic_name: "Bitcoin",
        topic_slug: "bitcoin",
        region_name: "Asia",
        region_slug: "asia",
      },
      {
        id: "bad",
        topic_slug: "missing-name",
        region_slug: "asia",
      },
    ]);

    assert.deepEqual(pages, [
      {
        id: "page-1",
        topicName: "Bitcoin",
        topicSlug: "bitcoin",
        regionName: "Asia",
        regionSlug: "asia",
        year: 2026,
        publishedAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "page-all",
        topicName: "Bitcoin",
        topicSlug: "bitcoin",
        regionName: "Asia",
        regionSlug: "asia",
        year: null,
        publishedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    assert.equal("status" in pages[0]!, false);
  });

  it("preserves year-scoped and all-years public paths", () => {
    assert.equal(
      formatResearchPagePublicPath("bitcoin", "asia", null),
      "/events/topics/bitcoin/regions/asia",
    );
    assert.equal(
      formatResearchPagePublicPath("bitcoin", "asia", 2026),
      "/events/topics/bitcoin/regions/asia/years/2026",
    );
  });

  it("dedupes series ids from keyword links without leaking empty values", () => {
    assert.deepEqual(
      readSeriesIdsFromKeywordLinks([
        { series_id: "s1" },
        { series_id: "s1" },
        { series_id: "  " },
        { series_id: "s2" },
        null,
      ]),
      ["s1", "s2"],
    );
  });
});
