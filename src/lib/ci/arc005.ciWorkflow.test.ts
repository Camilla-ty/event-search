import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("ARC-005 CI quality gate", () => {
  it("defines a PR/main workflow that runs typecheck, lint, test, and build", () => {
    const yaml = readFileSync(".github/workflows/ci.yml", "utf8");
    assert.match(yaml, /^name:\s*CI\s*$/m);
    assert.match(yaml, /pull_request:/);
    assert.match(yaml, /branches:\s*\n\s*-\s*main/);
    assert.match(yaml, /node-version:\s*"20"/);
    assert.match(yaml, /npm ci/);
    assert.match(yaml, /npm run typecheck/);
    assert.match(yaml, /npm run lint/);
    assert.match(yaml, /npm test/);
    assert.match(yaml, /npm run build/);
    assert.match(yaml, /NEXT_PUBLIC_SUPABASE_URL:/);
    assert.match(yaml, /NEXT_PUBLIC_SUPABASE_ANON_KEY:/);
    assert.doesNotMatch(yaml, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("keeps backup workflows separate from the quality gate", () => {
    const database = readFileSync(".github/workflows/backup-database.yml", "utf8");
    const storage = readFileSync(".github/workflows/backup-storage.yml", "utf8");
    assert.match(database, /Backup database/);
    assert.match(storage, /Backup storage/);
    assert.doesNotMatch(database, /npm run typecheck/);
    assert.doesNotMatch(storage, /npm run typecheck/);
  });

  it("exposes a stable typecheck npm script", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.equal(pkg.scripts?.typecheck, "tsc --noEmit");
  });
});
