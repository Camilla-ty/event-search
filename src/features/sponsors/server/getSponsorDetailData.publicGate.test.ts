import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSponsorDetailSummary } from "@/src/features/sponsors/server/getSponsorDetailData";
import { getCompanyIndexability } from "@/src/lib/seo/indexability";

describe("sponsor public count vs gated history", () => {
  it("exposes total sponsored edition count anonymously without history fields", () => {
    const summary = buildSponsorDetailSummary(
      {
        sponsored_edition_count: 7,
        latest_activity_at: "2026-01-01T00:00:00.000Z",
      },
      false,
    );

    assert.equal(summary.sponsoredEditionCount, 7);
    assert.equal("latestActivityAt" in summary, false);
    assert.equal(
      getCompanyIndexability({
        restricted: false,
        sponsoredEditionCount: summary.sponsoredEditionCount,
      }).indexable,
      true,
    );
  });

  it("keeps the same authoritative count for indexability when count is zero", () => {
    const summary = buildSponsorDetailSummary(null, false);
    assert.equal(summary.sponsoredEditionCount, 0);
    assert.equal(
      getCompanyIndexability({
        restricted: false,
        sponsoredEditionCount: summary.sponsoredEditionCount,
      }).includeInSitemap,
      false,
    );
  });

  it("flags the count as unknown when the stats query failed", () => {
    const summary = buildSponsorDetailSummary(null, false, {
      statsUnavailable: true,
    });

    assert.equal(summary.sponsoredEditionCount, 0);
    assert.equal(summary.sponsoredEditionCountUnknown, true);
  });

  it("does not flag unknown when stats loaded (even with zero rows present)", () => {
    const loaded = buildSponsorDetailSummary(
      { sponsored_edition_count: 0, latest_activity_at: null },
      false,
    );
    assert.equal(loaded.sponsoredEditionCountUnknown, undefined);

    // statsUnavailable is ignored when a row actually loaded.
    const loadedDespiteFlag = buildSponsorDetailSummary(
      { sponsored_edition_count: 2, latest_activity_at: null },
      false,
      { statsUnavailable: true },
    );
    assert.equal(loadedDespiteFlag.sponsoredEditionCountUnknown, undefined);
    assert.equal(loadedDespiteFlag.sponsoredEditionCount, 2);
  });

  it("authenticated summary may include latest activity but uses the same count", () => {
    const summary = buildSponsorDetailSummary(
      {
        sponsored_edition_count: 3,
        latest_activity_at: "2026-02-01T00:00:00.000Z",
      },
      true,
    );
    assert.equal(summary.sponsoredEditionCount, 3);
    assert.equal(summary.latestActivityAt, "2026-02-01T00:00:00.000Z");
  });
});
