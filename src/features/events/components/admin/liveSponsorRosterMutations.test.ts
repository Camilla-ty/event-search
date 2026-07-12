import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  applyRefetchedRoster,
  applySponsorCreate,
  applySponsorLabelEdit,
  applySponsorRemove,
  buildLiveSponsorRowFromCreate,
} from "@/src/features/events/components/admin/liveSponsorRosterMutations";
import type { LiveSponsorRow } from "@/src/features/events/components/admin/liveSponsorTypes";

function sponsor(
  id: string,
  tierRank: number | null,
  displayOrder: number | null,
  tierLabel: string | null = null,
): LiveSponsorRow {
  return {
    id,
    tier_rank: tierRank,
    tier_label: tierLabel,
    display_order: displayOrder,
    companies: {
      id: `company-${id}`,
      name: `Company ${id}`,
      slug: null,
      domain: `${id}.example`,
      logo_url: null,
      logo_source: null,
      logo_status: null,
      logo_fetched_at: null,
      aliases: [],
    },
  };
}

describe("applySponsorCreate", () => {
  it("appends a new sponsor row locally", () => {
    const roster = [sponsor("a", 1, 1)];
    const link = {
      id: "b",
      tier_rank: 1,
      tier_label: "Gold",
      display_order: 2,
      company_id: "company-b",
    };
    const company = { id: "company-b", name: "Beta Corp", domain: "beta.example" };

    const next = applySponsorCreate(roster, link, company);
    assert.equal(next.length, 2);
    assert.deepEqual(next[1], buildLiveSponsorRowFromCreate(link, company));
  });
});

describe("applySponsorRemove", () => {
  it("removes a sponsor row locally", () => {
    const roster = [sponsor("a", 1, 1), sponsor("b", 1, 2)];
    const next = applySponsorRemove(roster, "a");
    assert.deepEqual(
      next.map((row) => row.id),
      ["b"],
    );
  });
});

describe("applySponsorLabelEdit", () => {
  it("patches tier label locally", () => {
    const roster = [sponsor("a", 1, 1, "Silver")];
    const next = applySponsorLabelEdit(roster, "a", "Gold");
    assert.equal(next[0]?.tier_label, "Gold");
    assert.equal(roster[0]?.tier_label, "Silver");
  });
});

describe("applyRefetchedRoster", () => {
  it("replaces both rosters when order is clean", () => {
    const saved = [sponsor("a", 1, 1), sponsor("b", 1, 2)];
    const fresh = [sponsor("b", 1, 1), sponsor("a", 1, 2)];

    const next = applyRefetchedRoster(fresh, saved, saved);
    assert.deepEqual(next.savedRoster, fresh);
    assert.deepEqual(next.draftRoster, fresh);
  });

  it("preserves dirty draft roster during reorder error recovery", () => {
    const saved = [sponsor("a", 1, 1), sponsor("b", 1, 2), sponsor("c", 1, 3)];
    const draft = [sponsor("a", 1, 1), sponsor("c", 1, 2), sponsor("b", 1, 3)];
    const fresh = [sponsor("a", 1, 1), sponsor("b", 1, 2), sponsor("c", 1, 3)];

    const next = applyRefetchedRoster(fresh, saved, draft);
    assert.deepEqual(next.savedRoster, fresh);
    assert.deepEqual(
      next.draftRoster.map((row) => row.id),
      ["a", "c", "b"],
    );
  });
});

describe("EditionSponsorsPanel refresh policy", () => {
  it("does not call router.refresh on success paths", () => {
    const panelPath = path.join(
      process.cwd(),
      "src/features/events/components/admin/EditionSponsorsPanel.tsx",
    );
    const source = readFileSync(panelPath, "utf8");
    assert.equal(source.includes("router.refresh"), false);
    assert.equal(source.includes("useRouter"), false);
  });
});

describe("sponsor count synchronization", () => {
  it("derives count from roster length after local create/remove", () => {
    const roster = [sponsor("a", 1, 1)];
    const created = applySponsorCreate(roster, {
      id: "b",
      tier_rank: 2,
      tier_label: null,
      display_order: 1,
      company_id: "company-b",
    }, {
      id: "company-b",
      name: "Beta",
      domain: null,
    });
    assert.equal(created.length, 2);

    const removed = applySponsorRemove(created, "b");
    assert.equal(removed.length, 1);
  });
});
