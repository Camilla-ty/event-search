import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { getLiveSponsorsForEditionAdmin } from "@/src/features/events/server/eventEditionAdmin";

const EDITION_WITH_MANY_SPONSORS = "e64f2830-df7b-433f-af6b-4952e389902d";

describe("getLiveSponsorsForEditionAdmin", () => {
  it("loads large rosters by batching company lookups instead of one oversized .in() filter", async () => {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }

    const sponsors = await getLiveSponsorsForEditionAdmin(EDITION_WITH_MANY_SPONSORS);

    assert.ok(sponsors.length > 200, "expected a large sponsor roster for regression coverage");
    assert.equal(sponsors.length, sponsors.filter((row) => row.companies !== null).length);
  });
});
