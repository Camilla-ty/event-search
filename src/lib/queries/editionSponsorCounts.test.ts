import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fetchAllPaginatedSupabaseRows,
  SUPABASE_DEFAULT_PAGE_SIZE,
} from "@/src/lib/supabase/fetchAllPaginatedRows";

import {
  buildSponsorCountByEditionId,
  readSponsorCountForEdition,
} from "@/src/lib/queries/companies";

describe("buildSponsorCountByEditionId", () => {
  it("counts sponsor links per edition", () => {
    const counts = buildSponsorCountByEditionId([
      { event_editions_id: "11111111-1111-1111-1111-111111111111" },
      { event_editions_id: "11111111-1111-1111-1111-111111111111" },
      { event_editions_id: "22222222-2222-2222-2222-222222222222" },
    ]);

    assert.equal(
      readSponsorCountForEdition(counts, "11111111-1111-1111-1111-111111111111"),
      2,
    );
    assert.equal(
      readSponsorCountForEdition(counts, "22222222-2222-2222-2222-222222222222"),
      1,
    );
    assert.equal(readSponsorCountForEdition(counts, "33333333-3333-3333-3333-333333333333"), 0);
  });

  it("ignores rows without an edition id", () => {
    const counts = buildSponsorCountByEditionId([
      { event_editions_id: null },
      { event_editions_id: "  " },
    ]);

    assert.equal(counts.size, 0);
  });

  it("aggregates counts beyond the Supabase 1000-row page default", () => {
    const editionId = "11111111-1111-1111-1111-111111111111";
    const links = Array.from({ length: 1001 }, () => ({
      event_editions_id: editionId,
    }));

    const counts = buildSponsorCountByEditionId(links);

    assert.equal(readSponsorCountForEdition(counts, editionId), 1001);
  });
});

const TARGET_EDITION_ID = "11111111-1111-1111-1111-111111111111";

describe("edition sponsor count pagination regressions", () => {
  it("counts sponsor links beyond the first 1,000 event_sponsors rows", () => {
    const allLinks = [
      ...Array.from({ length: SUPABASE_DEFAULT_PAGE_SIZE }, (_, index) => ({
        event_editions_id: `filler-edition-${index}`,
      })),
      { event_editions_id: TARGET_EDITION_ID },
      { event_editions_id: TARGET_EDITION_ID },
      { event_editions_id: TARGET_EDITION_ID },
    ];

    const truncated = buildSponsorCountByEditionId(
      allLinks.slice(0, SUPABASE_DEFAULT_PAGE_SIZE),
    );
    const full = buildSponsorCountByEditionId(allLinks);

    assert.equal(readSponsorCountForEdition(truncated, TARGET_EDITION_ID), 0);
    assert.equal(readSponsorCountForEdition(full, TARGET_EDITION_ID), 3);
  });

  it("loads all event_sponsors pages before aggregating edition counts", async () => {
    const allLinks = Array.from({ length: 1001 }, (_, index) => ({
      event_editions_id:
        index < 1000 ? `filler-edition-${index}` : TARGET_EDITION_ID,
    }));

    const loaded = await fetchAllPaginatedSupabaseRows(async ({ from, to }) => ({
      data: allLinks.slice(from, to + 1),
      error: null,
    }));

    const counts = buildSponsorCountByEditionId(loaded);
    assert.equal(loaded.length, 1001);
    assert.equal(readSponsorCountForEdition(counts, TARGET_EDITION_ID), 1);
  });
});
