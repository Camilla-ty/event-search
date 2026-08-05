import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  PUBLIC_STATS_ALLOWED_ORIGINS,
  publicStatsCorsHeaders,
  resolvePublicStatsCorsOrigin,
} from "@/src/lib/http/publicStatsCors";

const routePath = join(process.cwd(), "src/app/api/public/stats/route.ts");

describe("publicStatsCors", () => {
  it("allows only the marketing-site origins", () => {
    assert.deepEqual([...PUBLIC_STATS_ALLOWED_ORIGINS], [
      "https://eventpx.com",
      "https://www.eventpx.com",
    ]);
    assert.equal(resolvePublicStatsCorsOrigin("https://eventpx.com"), "https://eventpx.com");
    assert.equal(
      resolvePublicStatsCorsOrigin("https://www.eventpx.com"),
      "https://www.eventpx.com",
    );
    assert.equal(resolvePublicStatsCorsOrigin("https://app.eventpx.com"), null);
    assert.equal(resolvePublicStatsCorsOrigin("https://evil.example"), null);
    assert.equal(resolvePublicStatsCorsOrigin(null), null);
    assert.equal(resolvePublicStatsCorsOrigin(""), null);
  });

  it("returns CORS headers only for allowlisted origins", () => {
    assert.deepEqual(publicStatsCorsHeaders("https://eventpx.com"), {
      "Access-Control-Allow-Origin": "https://eventpx.com",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      Vary: "Origin",
    });
    assert.deepEqual(publicStatsCorsHeaders("https://app.eventpx.com"), {});
    assert.deepEqual(publicStatsCorsHeaders(null), {});
  });

  it("public stats route wires route-level CORS without global middleware", () => {
    const source = readFileSync(routePath, "utf8");
    assert.match(source, /publicStatsCorsHeaders/);
    assert.match(source, /export async function OPTIONS/);
    assert.match(source, /request\.headers\.get\("Origin"\)/);
    assert.doesNotMatch(source, /Access-Control-Allow-Origin:\s*"\*"/);
  });
});
