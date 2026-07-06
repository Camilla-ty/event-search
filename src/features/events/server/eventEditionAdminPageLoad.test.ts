import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { EventEditionAdminRow } from "@/src/features/events/server/eventEditionAdmin";
import {
  ADMIN_EDITION_PANEL_LABELS,
  adminEditionPanelErrorMessage,
  formatAdminEditionLoadError,
  loadAdminEditionOptionalPanels,
  loadAdminEditionRequired,
} from "@/src/features/events/server/eventEditionAdminPageLoad";

const sampleEdition: EventEditionAdminRow = {
  id: "e64f2830-df7b-433f-af6b-4952e389902d",
  series_id: "00000000-0000-0000-0000-000000000001",
  year: 2026,
  name: "Sample Edition",
  slug: "sample-edition",
  start_date: null,
  end_date: null,
  website_url: null,
  logo_url: null,
  city_id: null,
  venue_id: null,
  last_reviewed_at: null,
  primary_source_url: null,
  created_at: null,
  event_series: {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Sample Series",
    slug: "sample-series",
  },
};

describe("formatAdminEditionLoadError", () => {
  it("uses Error.message when present", () => {
    assert.equal(
      formatAdminEditionLoadError(new Error("TypeError: fetch failed")),
      "TypeError: fetch failed",
    );
  });

  it("falls back to a generic message", () => {
    assert.equal(formatAdminEditionLoadError(undefined), "Could not load edition data.");
  });
});

describe("loadAdminEditionRequired", () => {
  it("returns loadError instead of throwing when edition lookup fails", async () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://invalid.example.test";

    try {
      const result = await loadAdminEditionRequired(sampleEdition.id);
      assert.equal(result.edition, null);
      assert.equal(result.loadError, "TypeError: fetch failed");
    } finally {
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  });
});

describe("loadAdminEditionOptionalPanels", () => {
  it("returns empty fallbacks and panelErrors when optional loaders throw fetch failed", async () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://invalid.example.test";

    try {
      const result = await loadAdminEditionOptionalPanels(sampleEdition);

      assert.deepEqual(result.cities, []);
      assert.deepEqual(result.series, []);
      assert.equal(result.liveSponsorCount, 0);
      assert.deepEqual(result.sponsors, []);
      assert.deepEqual(result.organizers, []);
      assert.deepEqual(result.inheritedKeywords, []);
      assert.equal(result.importsData.editionId, sampleEdition.id);
      assert.equal(result.importsData.activeBatch, null);
      assert.deepEqual(result.importsData.batches, []);

      for (const key of Object.keys(ADMIN_EDITION_PANEL_LABELS) as Array<
        keyof typeof ADMIN_EDITION_PANEL_LABELS
      >) {
        assert.equal(result.panelErrors[key], "TypeError: fetch failed");
      }
    } finally {
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  });
});

describe("adminEditionPanelErrorMessage", () => {
  it("returns null when a panel did not fail", () => {
    assert.equal(adminEditionPanelErrorMessage({}, "sponsors"), null);
  });
});
