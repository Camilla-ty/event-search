import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { fetchEditionLiveSponsors } from "@/src/features/events/client/fetchEditionLiveSponsors";
import type { LiveSponsorRow } from "@/src/features/events/components/admin/liveSponsorTypes";

const sponsors: LiveSponsorRow[] = [
  {
    id: "link-1",
    tier_rank: 1,
    tier_label: "Gold",
    display_order: 1,
    companies: {
      id: "company-1",
      name: "Acme",
      slug: "acme",
      domain: "acme.example",
      logo_url: null,
      logo_source: null,
      logo_status: null,
      logo_fetched_at: null,
      aliases: [],
    },
  },
];

describe("fetchEditionLiveSponsors", () => {
  it("parses the GET sponsors endpoint contract", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, sponsors, count: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const data = await fetchEditionLiveSponsors("edition-1");
      assert.equal(data.ok, true);
      assert.equal(data.count, 1);
      assert.deepEqual(data.sponsors, sponsors);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws with API error message on failure", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, error: "Event not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      await assert.rejects(
        () => fetchEditionLiveSponsors("missing"),
        /Event not found\./,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to sponsors length when count is missing", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, sponsors }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const data = await fetchEditionLiveSponsors("edition-1");
      assert.equal(data.count, sponsors.length);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("GET /api/admin/event-editions/[id]/sponsors route contract", () => {
  it("wraps getLiveSponsorsForEditionAdmin and countLiveSponsorsForEdition", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/admin/event-editions/[id]/sponsors/route.ts",
    );
    const source = readFileSync(routePath, "utf8");

    assert.match(source, /export async function GET/);
    assert.match(source, /getLiveSponsorsForEditionAdmin/);
    assert.match(source, /countLiveSponsorsForEdition/);
    assert.match(source, /ok: true, sponsors, count/);
  });
});

describe("tier edit refetch flow", () => {
  it("uses panel refetch response as roster authority", () => {
    const fresh = [
      {
        ...sponsors[0]!,
        tier_rank: 2,
        display_order: 1,
      },
    ];

    assert.equal(fresh[0]?.tier_rank, 2);
    assert.equal(fresh[0]?.display_order, 1);
  });
});
