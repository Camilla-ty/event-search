import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const sourcePath = join(process.cwd(), "src/lib/queries/companies.ts");

/**
 * ARC-001 Phase 2 wiring: public sponsor counts must not use createAdminClient.
 */
describe("companies sponsor counts wiring (ARC-001 Phase 2)", () => {
  const source = readFileSync(sourcePath, "utf8");

  function sliceExport(marker: string): string {
    const start = source.indexOf(marker);
    assert.ok(start >= 0, `expected ${marker}`);
    const nextExport = source.indexOf("\nexport ", start + 1);
    const end = nextExport > start ? nextExport : source.length;
    return source.slice(start, end);
  }

  it("getSponsorCountsByEditionIds uses the public aggregate view without admin", () => {
    const body = sliceExport("export async function getSponsorCountsByEditionIds");
    assert.match(body, /createClient/);
    assert.match(body, /event_edition_sponsor_counts/);
    assert.doesNotMatch(body, /createAdminClient/);
    assert.doesNotMatch(body, /fetchAllPaginatedSupabaseRows/);
    assert.doesNotMatch(body, /\.from\("event_sponsors"\)/);
  });

  it("getTotalSponsorCount delegates to getSponsorCountsByEditionIds without admin", () => {
    const body = sliceExport("export async function getTotalSponsorCount");
    assert.match(body, /getSponsorCountsByEditionIds/);
    assert.doesNotMatch(body, /createAdminClient/);
  });

  it("companies.ts no longer imports createAdminClient for sponsor counts", () => {
    assert.doesNotMatch(source, /from "@\/src\/lib\/supabase\/admin"/);
    assert.doesNotMatch(source, /createAdminClient/);
  });
});
