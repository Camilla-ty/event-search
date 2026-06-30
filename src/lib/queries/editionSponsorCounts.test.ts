import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
});
