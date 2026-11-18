import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

describe("sponsor import match route / Review contracts", () => {
  it("sets maxDuration = 300 on the match route", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/admin/sponsor-imports/batches/[batchId]/match/route.ts",
      ),
      "utf8",
    );
    assert.match(source, /export const maxDuration = 300/);
  });

  it("ReviewQueueStep bootstraps matching then always loads rows via helper", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsor-import/components/steps/ReviewQueueStep.tsx",
      ),
      "utf8",
    );
    assert.match(source, /bootstrapReviewMatching/);
    assert.match(source, /runMatching:\s*\(\)\s*=>\s*runMatching\(batch\.id\)/);
    assert.match(source, /loadRows:\s*\(\)\s*=>\s*loadRowsForFilter\("needs_review"\)/);
  });

  it("guards Supabase match row updates on still-matchable status and detects 0-row updates", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/server/sponsorImportAdmin.ts"),
      "utf8",
    );
    assert.match(source, /const MATCHABLE_ROW_STATUSES = \["needs_review", "auto_ready"\] as const;/);
    assert.match(
      source,
      /updateRowIfStillMatchable: async[\s\S]*?\.eq\("id", rowId\)\s*\.eq\("batch_id", batchId\)\s*\.in\("status", \[\.\.\.MATCHABLE_ROW_STATUSES\]\)\s*\.select\("id"\);[\s\S]*?return \(data \?\? \[\]\)\.length > 0;/,
    );
  });

  it("treats matching as current only when matching_run is newer than mapping/validation logs", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/server/sponsorImportAdmin.ts"),
      "utf8",
    );
    assert.match(
      source,
      /hasCurrentMatchingRun: async[\s\S]*?\.in\("action_type", \["matching_run", \.\.\.MATCHING_INVALIDATING_ACTION_TYPES\]\)\s*\.order\("created_at", \{ ascending: false \}\)\s*\.limit\(1\)[\s\S]*?isMatchingRunCurrent\(/,
    );
  });

  it("runMatching uses postSponsorImportJson with MATCH_TIMEOUT_MS and optional force", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/features/sponsor-import/client/api.ts"),
      "utf8",
    );
    assert.match(source, /postSponsorImportJson/);
    assert.match(source, /MATCH_TIMEOUT_MS/);
    assert.match(source, /force:\s*true/);
  });
});
