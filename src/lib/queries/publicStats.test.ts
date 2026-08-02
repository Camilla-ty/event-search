import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  mapPublicCatalogStatsRow,
} from "@/src/lib/queries/publicStats";

const sourcePath = join(process.cwd(), "src/lib/queries/publicStats.ts");
const routePath = join(process.cwd(), "src/app/api/public/stats/route.ts");
const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260802130000_public_catalog_stats.sql",
);

describe("getPublicStats wiring (ARC-001 Phase 3)", () => {
  it("getPublicStats uses the public aggregate view without createAdminClient", () => {
    const source = readFileSync(sourcePath, "utf8");
    assert.match(source, /createClient/);
    assert.match(source, /public_catalog_stats/);
    assert.match(source, /mapPublicCatalogStatsRow/);
    assert.doesNotMatch(source, /createAdminClient/);
    assert.doesNotMatch(source, /from "@\/src\/lib\/supabase\/admin"/);
    assert.doesNotMatch(source, /\.from\("event_editions"\)/);
    assert.doesNotMatch(source, /\.from\("companies"\)/);
    assert.doesNotMatch(source, /\.from\("event_edition_organizers"\)/);
  });

  it("public stats API route keeps the existing response contract", () => {
    const source = readFileSync(routePath, "utf8");
    assert.match(source, /getPublicStats/);
    assert.match(source, /NextResponse\.json\(stats/);
    assert.match(source, /revalidate = 3600/);
    assert.match(source, /Cache-Control.*s-maxage=3600/);
    assert.doesNotMatch(source, /createAdminClient/);
    assert.doesNotMatch(source, /ok:\s*true/);
  });

  it("migration exposes aggregate columns only with SELECT grants", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /public_catalog_stats/);
    assert.match(sql, /security_invoker\s*=\s*false/i);
    assert.match(sql, /REVOKE ALL ON public\.public_catalog_stats FROM PUBLIC, anon, authenticated/);
    assert.match(sql, /GRANT SELECT ON public\.public_catalog_stats TO anon, authenticated/);

    const selectBody = sql.match(/AS\s*\nSELECT([\s\S]*?);/)?.[1] ?? "";
    assert.match(selectBody, /\bevents\b/);
    assert.match(selectBody, /\bsponsors\b/);
    assert.match(selectBody, /\borganizers\b/);
    assert.match(selectBody, /\bevent_cities\b/);
    assert.doesNotMatch(selectBody, /\bcompany_id\b/);
    assert.doesNotMatch(selectBody, /\bname\b/);
    assert.doesNotMatch(selectBody, /\bslug\b/);
    assert.doesNotMatch(selectBody, /\bdomain\b/);
    assert.doesNotMatch(selectBody, /\blogo_url\b/);
  });
});

describe("mapPublicCatalogStatsRow", () => {
  it("maps aggregate view rows into the public API shape", () => {
    assert.deepEqual(
      mapPublicCatalogStatsRow({
        events: 93,
        sponsors: 4616,
        organizers: 87,
        event_cities: 28,
      }),
      { events: 93, sponsors: 4616, organizers: 87, eventCities: 28 },
    );
  });

  it("fails closed to zeros for missing or invalid aggregates", () => {
    assert.deepEqual(mapPublicCatalogStatsRow(null), {
      events: 0,
      sponsors: 0,
      organizers: 0,
      eventCities: 0,
    });
    assert.deepEqual(
      mapPublicCatalogStatsRow({
        events: -2.7,
        sponsors: "nope",
        organizers: Number.NaN,
        event_cities: null,
      }),
      { events: 0, sponsors: 0, organizers: 0, eventCities: 0 },
    );
  });

  it("does not surface identity fields on the public stats object", () => {
    const stats = mapPublicCatalogStatsRow({
      events: 1,
      sponsors: 2,
      organizers: 3,
      event_cities: 4,
    });
    assert.deepEqual(Object.keys(stats).sort(), [
      "eventCities",
      "events",
      "organizers",
      "sponsors",
    ]);
    assert.equal("id" in stats, false);
    assert.equal("company_id" in stats, false);
    assert.equal("city_id" in stats, false);
  });
});
