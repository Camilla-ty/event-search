import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPublicPartnerAlumniForSeriesId,
  mapPublicPartnerAlumniMembers,
  shouldShowPublicPartnerAlumniTab,
} from "@/src/features/partner-alumni/server/partnerAlumniPublic";

describe("mapPublicPartnerAlumniMembers", () => {
  it("maps and sorts members by display_order then id", () => {
    const members = mapPublicPartnerAlumniMembers([
      {
        id: "b-member",
        display_order: 2,
        companies: { id: "c2", name: "Beta", slug: "beta" },
      },
      {
        id: "a-member",
        display_order: 1,
        companies: { id: "c1", name: "Alpha", slug: "alpha" },
      },
    ]);

    assert.equal(members.length, 2);
    assert.equal(members[0]?.id, "a-member");
    assert.equal(members[0]?.company?.name, "Alpha");
    assert.equal(members[1]?.id, "b-member");
  });

  it("skips rows without id", () => {
    const members = mapPublicPartnerAlumniMembers([
      { display_order: 1, companies: { id: "c1", name: "Alpha" } },
    ]);
    assert.equal(members.length, 0);
  });
});

describe("shouldShowPublicPartnerAlumniTab", () => {
  it("returns false when current version is null", () => {
    assert.equal(shouldShowPublicPartnerAlumniTab(null), false);
  });

  it("returns false when current version has no companies", () => {
    assert.equal(
      shouldShowPublicPartnerAlumniTab({
        recognition_label: "Partners",
        primary_source_url: null,
        source_checked_at: "2026-07-01T00:00:00.000Z",
        members: [],
      }),
      false,
    );
  });

  it("returns true when current version has at least one company", () => {
    assert.equal(
      shouldShowPublicPartnerAlumniTab({
        recognition_label: "Partners",
        primary_source_url: null,
        source_checked_at: "2026-07-01T00:00:00.000Z",
        members: [
          {
            id: "m1",
            display_order: 1,
            company: { id: "c1", name: "Acme" },
          },
        ],
      }),
      true,
    );
  });
});

describe("getPublicPartnerAlumniForSeriesId", () => {
  it("returns null for blank series id without throwing", async () => {
    assert.equal(await getPublicPartnerAlumniForSeriesId(""), null);
    assert.equal(await getPublicPartnerAlumniForSeriesId("   "), null);
  });

  it("returns null when supabase session client cannot be created", async () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      assert.equal(
        await getPublicPartnerAlumniForSeriesId("00000000-0000-0000-0000-000000000001"),
        null,
      );
    } finally {
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
      if (previousAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
    }
  });
});
