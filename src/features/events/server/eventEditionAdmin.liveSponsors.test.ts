import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { getLiveSponsorsForEditionAdmin } from "@/src/features/events/server/eventEditionAdmin";
import { SUPABASE_IN_FILTER_BATCH_SIZE } from "@/src/lib/supabase/fetchInBatches";
import type { createAdminClient } from "@/src/lib/supabase/admin";

const eventsServerDir = dirname(fileURLToPath(import.meta.url));
const EDITION_ID = "e64f2830-df7b-433f-af6b-4952e389902d";
const LARGE_ROSTER_SIZE = 250;

type AdminClient = ReturnType<typeof createAdminClient>;

type SponsorLink = {
  id: string;
  company_id: string;
  tier_rank: number;
  tier_label: string;
  display_order: number;
};

function companyIdForIndex(index: number): string {
  return `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`;
}

function buildLargeRosterLinks(count: number): SponsorLink[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `11111111-1111-1111-1111-${String(index).padStart(12, "0")}`,
    company_id: companyIdForIndex(index),
    tier_rank: 1,
    tier_label: "Gold",
    display_order: index,
  }));
}

/** Minimal PostgREST-shaped client for getLiveSponsorsForEditionAdmin (no network). */
function createFakeAdminClient(links: SponsorLink[], companyInBatchSizes: number[]): AdminClient {
  return {
    from(table: string) {
      if (table === "event_sponsors") {
        const query = {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          range(from: number, to: number) {
            return Promise.resolve({
              data: links.slice(from, to + 1),
              error: null,
            });
          },
        };
        return query;
      }

      if (table === "companies") {
        const query = {
          select() {
            return this;
          },
          in(_column: string, batchIds: string[]) {
            companyInBatchSizes.push(batchIds.length);
            return Promise.resolve({
              data: batchIds.map((id) => ({
                id,
                name: `Company ${id.slice(-4)}`,
                slug: `company-${id.slice(-4)}`,
                domain: null,
                logo_url: null,
                logo_source: null,
                logo_status: null,
                logo_fetched_at: null,
                aliases: [],
              })),
              error: null,
            });
          },
        };
        return query;
      }

      throw new Error(`Unexpected table in fake admin client: ${table}`);
    },
  } as unknown as AdminClient;
}

describe("getLiveSponsorsForEditionAdmin", () => {
  it("uses fetchAllByIdInBatches for company hydration (not one oversized .in())", () => {
    const source = readFileSync(join(eventsServerDir, "eventEditionAdmin.ts"), "utf8");
    const marker = "export async function getLiveSponsorsForEditionAdmin";
    const start = source.indexOf(marker);
    assert.notEqual(start, -1);
    const nextExport = source.indexOf("\nexport ", start + marker.length);
    const body = nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);

    assert.match(body, /fetchAllByIdInBatches\(companyIds/);
    assert.doesNotMatch(body, /\.in\("id",\s*companyIds\)/);
  });

  it("loads large rosters by batching company lookups instead of one oversized .in() filter", async () => {
    const links = buildLargeRosterLinks(LARGE_ROSTER_SIZE);
    const companyInBatchSizes: number[] = [];
    const supabase = createFakeAdminClient(links, companyInBatchSizes);

    const sponsors = await getLiveSponsorsForEditionAdmin(EDITION_ID, supabase);

    assert.equal(sponsors.length, LARGE_ROSTER_SIZE);
    assert.ok(sponsors.length > 200, "expected a large sponsor roster for regression coverage");
    assert.equal(sponsors.length, sponsors.filter((row) => row.companies !== null).length);
    assert.deepEqual(companyInBatchSizes, [
      SUPABASE_IN_FILTER_BATCH_SIZE,
      SUPABASE_IN_FILTER_BATCH_SIZE,
      50,
    ]);
    assert.ok(
      companyInBatchSizes.every((size) => size <= SUPABASE_IN_FILTER_BATCH_SIZE),
      "every companies .in() batch must stay within SUPABASE_IN_FILTER_BATCH_SIZE",
    );
  });
});
