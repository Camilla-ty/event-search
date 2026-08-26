import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  RESEARCH_PAGE_LOCATION_SEGMENT,
  isResearchPageLocationType,
  parseResearchPageLocationType,
  researchPageLocationLabel,
} from "@/src/features/research-pages/lib/researchPageLocation";

describe("researchPageLocation", () => {
  it("accepts only region and country", () => {
    assert.equal(isResearchPageLocationType("region"), true);
    assert.equal(isResearchPageLocationType("country"), true);
    assert.equal(isResearchPageLocationType("city"), false);
    assert.equal(isResearchPageLocationType(null), false);
  });

  it("parses and normalises raw input", () => {
    assert.equal(parseResearchPageLocationType(" Country "), "country");
    assert.equal(parseResearchPageLocationType("REGION"), "region");
    assert.equal(parseResearchPageLocationType("state"), null);
    assert.equal(parseResearchPageLocationType(undefined), null);
  });

  it("maps each location type to a distinct URL segment", () => {
    assert.equal(RESEARCH_PAGE_LOCATION_SEGMENT.region, "regions");
    assert.equal(RESEARCH_PAGE_LOCATION_SEGMENT.country, "countries");
  });

  it("labels location types for admin copy", () => {
    assert.equal(researchPageLocationLabel("region"), "Region");
    assert.equal(researchPageLocationLabel("country"), "Country");
  });
});

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260826010000_research_pages_country_support.sql",
);

describe("country-support migration contract", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("makes region_id nullable and adds a country FK", () => {
    assert.match(sql, /ALTER COLUMN region_id DROP NOT NULL/);
    assert.match(
      sql,
      /FOREIGN KEY \(country_id\) REFERENCES public\.countries \(id\)/,
    );
  });

  it("enforces exactly one location per research page", () => {
    assert.match(sql, /CHECK \(num_nonnulls\(region_id, country_id\) = 1\)/);
  });

  it("keeps uniqueness per location kind, including all-years rows", () => {
    assert.match(
      sql,
      /CREATE UNIQUE INDEX IF NOT EXISTS topic_region_research_pages_topic_region_year_key[\s\S]*?WHERE region_id IS NOT NULL/,
    );
    assert.match(
      sql,
      /CREATE UNIQUE INDEX IF NOT EXISTS topic_region_research_pages_topic_country_year_key[\s\S]*?WHERE country_id IS NOT NULL/,
    );
    assert.match(sql, /COALESCE\(\(year\)::integer, 0\)/);
  });

  it("rebuilds the published view so country pages are not filtered out", () => {
    assert.match(sql, /DROP VIEW IF EXISTS public\.topic_region_research_pages_published/);
    assert.match(sql, /LEFT JOIN public\.regions r/);
    assert.match(sql, /LEFT JOIN public\.countries co/);
    assert.match(sql, /COALESCE\(co\.slug, r\.slug\) AS location_slug/);
    assert.match(sql, /WHERE p\.status = 'published'/);
  });

  it("re-grants the narrow public SELECT after recreating the view", () => {
    assert.match(sql, /security_invoker\s*=\s*false/i);
    assert.match(
      sql,
      /REVOKE ALL ON public\.topic_region_research_pages_published FROM PUBLIC, anon, authenticated/,
    );
    assert.match(
      sql,
      /GRANT SELECT ON public\.topic_region_research_pages_published TO anon, authenticated/,
    );
  });

  it("fixes the truncated Thailand slug before it becomes a public URL", () => {
    assert.match(sql, /SET slug = 'thailand'/);
    assert.match(sql, /WHERE slug = 'thailan'/);
  });
});

describe("public country hub routes", () => {
  it("exposes all-years and year-scoped country routes", () => {
    for (const route of [
      "src/app/(marketing)/events/topics/[topicSlug]/countries/[countrySlug]/page.tsx",
      "src/app/(marketing)/events/topics/[topicSlug]/countries/[countrySlug]/years/[year]/page.tsx",
    ]) {
      const path = join(process.cwd(), route);
      assert.equal(existsSync(path), true, `missing route ${route}`);
      const source = readFileSync(path, "utf8");
      assert.match(source, /type: "country"/);
      assert.match(source, /getPublishedResearchPageBySlugsPublic/);
      assert.match(source, /getTopicRegionHubIndexability/);
      assert.doesNotMatch(source, /researchPageAdmin/);
    }
  });
});
