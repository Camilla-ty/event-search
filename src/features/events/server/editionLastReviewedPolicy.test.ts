import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyEditionUpdateLastReviewedPolicy,
  editionCreateLastReviewedAtValue,
  hasMeaningfulEditionFieldChange,
  shouldAutoTouchAfterPublish,
  shouldAutoTouchSponsorUpdate,
  shouldSetAutoReviewTimestamp,
  type EditionLastReviewedSnapshot,
} from "@/src/features/events/server/editionLastReviewedPolicy";

const existing: EditionLastReviewedSnapshot = {
  name: "TOKEN2049",
  slug: "token2049-2026",
  start_date: "2026-09-01",
  end_date: "2026-09-03",
  website_url: "https://token2049.com",
  city_id: "11111111-1111-1111-1111-111111111111",
  venue_id: null,
};

describe("shouldSetAutoReviewTimestamp", () => {
  it("returns false for manual-only last_reviewed_at saves", () => {
    assert.equal(
      shouldSetAutoReviewTimestamp(existing, {
        last_reviewed_at: "2024-06-01T00:00:00.000Z",
      }),
      false,
    );
  });

  it("returns false for manual-only primary_source_url saves", () => {
    assert.equal(
      shouldSetAutoReviewTimestamp(existing, {
        primary_source_url: "https://example.com/source",
      }),
      false,
    );
  });

  it("returns false for manual-only sponsor_note_type saves", () => {
    assert.equal(
      shouldSetAutoReviewTimestamp(existing, {
        sponsor_note_type: "upcoming_pending",
      }),
      false,
    );
  });

  it("returns false when meaningful fields are present but unchanged", () => {
    assert.equal(
      shouldSetAutoReviewTimestamp(existing, {
        name: "TOKEN2049",
        website_url: "https://token2049.com",
      }),
      false,
    );
  });

  it("returns true when a meaningful field changes", () => {
    assert.equal(
      shouldSetAutoReviewTimestamp(existing, {
        name: "TOKEN2049 Singapore",
      }),
      true,
    );
  });

  it("returns true when meaningful and research fields change together", () => {
    assert.equal(
      shouldSetAutoReviewTimestamp(existing, {
        name: "TOKEN2049 Singapore",
        last_reviewed_at: "2024-06-01T00:00:00.000Z",
      }),
      true,
    );
  });

  it("treats website empty string as null when comparing", () => {
    assert.equal(
      hasMeaningfulEditionFieldChange(
        { ...existing, website_url: null },
        { website_url: "" },
      ),
      false,
    );
  });

  it("detects venue assignment changes", () => {
    assert.equal(
      shouldSetAutoReviewTimestamp(existing, {
        venue_id: "22222222-2222-2222-2222-222222222222",
      }),
      true,
    );
  });
});

describe("editionCreateLastReviewedAtValue", () => {
  it("always returns null even when create input includes a review date", () => {
    assert.equal(editionCreateLastReviewedAtValue(), null);
  });
});

describe("applyEditionUpdateLastReviewedPolicy", () => {
  const fixedNow = "2026-07-03T12:00:00.000Z";

  it("sets last_reviewed_at when a meaningful field changes", () => {
    const result = applyEditionUpdateLastReviewedPolicy(
      existing,
      { name: "TOKEN2049 Singapore" },
      fixedNow,
    );
    assert.equal(result.last_reviewed_at, fixedNow);
    assert.equal(result.name, "TOKEN2049 Singapore");
  });

  it("preserves manual-only last_reviewed_at without auto-touch", () => {
    const manualDate = "2024-06-01T00:00:00.000Z";
    const result = applyEditionUpdateLastReviewedPolicy(
      existing,
      { last_reviewed_at: manualDate },
      fixedNow,
    );
    assert.equal(result.last_reviewed_at, manualDate);
  });

  it("overrides manual date when a meaningful field changes in the same patch", () => {
    const result = applyEditionUpdateLastReviewedPolicy(
      existing,
      {
        name: "TOKEN2049 Singapore",
        last_reviewed_at: "2024-06-01T00:00:00.000Z",
      },
      fixedNow,
    );
    assert.equal(result.last_reviewed_at, fixedNow);
  });
});

describe("shouldAutoTouchSponsorUpdate", () => {
  const sponsor: { tier_rank: number | null; tier_label: string | null } = {
    tier_rank: 1,
    tier_label: "Title",
  };

  it("returns true when tier_rank changes", () => {
    assert.equal(shouldAutoTouchSponsorUpdate(sponsor, { tier_rank: 2 }), true);
  });

  it("returns true when tier_label changes", () => {
    assert.equal(
      shouldAutoTouchSponsorUpdate(sponsor, { tier_label: "Gold" }),
      true,
    );
  });

  it("returns false when tier values are unchanged", () => {
    assert.equal(
      shouldAutoTouchSponsorUpdate(sponsor, {
        tier_rank: 1,
        tier_label: "Title",
      }),
      false,
    );
  });

  it("treats blank tier_label as null", () => {
    assert.equal(
      shouldAutoTouchSponsorUpdate({ tier_rank: 1, tier_label: null }, { tier_label: "" }),
      false,
    );
    assert.equal(
      shouldAutoTouchSponsorUpdate({ tier_rank: 1, tier_label: "Title" }, { tier_label: "" }),
      true,
    );
  });
});

describe("shouldAutoTouchAfterPublish", () => {
  it("returns true when new sponsors were published", () => {
    assert.equal(
      shouldAutoTouchAfterPublish({
        new_count: 3,
        tier_updated_count: 0,
        unchanged_count: 0,
        excluded_count: 0,
      }),
      true,
    );
  });

  it("returns true when tier rank was updated", () => {
    assert.equal(
      shouldAutoTouchAfterPublish({
        new_count: 0,
        tier_updated_count: 2,
        unchanged_count: 0,
        excluded_count: 0,
      }),
      true,
    );
  });

  it("returns true when unchanged-tier tier_label sync ran", () => {
    assert.equal(
      shouldAutoTouchAfterPublish({
        new_count: 0,
        tier_updated_count: 0,
        unchanged_count: 5,
        excluded_count: 0,
      }),
      true,
    );
  });

  it("returns false when only rows were excluded", () => {
    assert.equal(
      shouldAutoTouchAfterPublish({
        new_count: 0,
        tier_updated_count: 0,
        unchanged_count: 0,
        excluded_count: 4,
      }),
      false,
    );
  });

  it("returns false when all publish counts are zero", () => {
    assert.equal(
      shouldAutoTouchAfterPublish({
        new_count: 0,
        tier_updated_count: 0,
        unchanged_count: 0,
        excluded_count: 0,
      }),
      false,
    );
  });
});
