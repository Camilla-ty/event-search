import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MergeCompanyPickerOption } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import {
  applyCanonicalCompanyIdChange,
  canSelectCanonicalCompanyId,
  resolveInitialCanonicalCompanyId,
} from "@/src/features/companies/components/admin/merge/mergeWizardCanonical";

function company(
  overrides: Partial<MergeCompanyPickerOption> & Pick<MergeCompanyPickerOption, "id" | "name">,
): MergeCompanyPickerOption {
  return {
    slug: "slug",
    domain: null,
    website: null,
    logo_url: null,
    sponsor_link_count: 0,
    matched_alias: null,
    created_at: null,
    ...overrides,
  };
}

const keeper = company({
  id: "keeper-id",
  name: "Keeper Co",
  sponsor_link_count: 1,
});

const duplicate = company({
  id: "duplicate-id",
  name: "Duplicate Co",
  sponsor_link_count: 99,
  domain: "duplicate.example",
  created_at: "2000-01-01T00:00:00Z",
});

const suggestAlwaysDuplicate = () => duplicate.id;

describe("mergeWizardCanonical", () => {
  it("lockCanonical forces company A as canonical", () => {
    assert.equal(
      resolveInitialCanonicalCompanyId(keeper, duplicate, { lockCanonical: true, lockDuplicate: false }, suggestAlwaysDuplicate),
      keeper.id,
    );
  });

  it("lockDuplicate forces company A as canonical", () => {
    assert.equal(
      resolveInitialCanonicalCompanyId(keeper, duplicate, { lockCanonical: false, lockDuplicate: true }, suggestAlwaysDuplicate),
      keeper.id,
    );
  });

  it("uses suggestion only when neither side is locked", () => {
    assert.equal(
      resolveInitialCanonicalCompanyId(keeper, duplicate, { lockCanonical: false, lockDuplicate: false }, suggestAlwaysDuplicate),
      duplicate.id,
    );
  });

  it("blocks selecting locked duplicate as canonical", () => {
    const locks = { lockCanonical: false, lockDuplicate: true };
    assert.equal(canSelectCanonicalCompanyId(keeper.id, keeper, duplicate, locks), true);
    assert.equal(canSelectCanonicalCompanyId(duplicate.id, keeper, duplicate, locks), false);
    assert.equal(
      applyCanonicalCompanyIdChange(duplicate.id, keeper, duplicate, locks, keeper.id),
      keeper.id,
    );
  });

  it("blocks changing away from locked canonical", () => {
    const locks = { lockCanonical: true, lockDuplicate: false };
    assert.equal(canSelectCanonicalCompanyId(keeper.id, keeper, duplicate, locks), true);
    assert.equal(canSelectCanonicalCompanyId(duplicate.id, keeper, duplicate, locks), false);
    assert.equal(
      applyCanonicalCompanyIdChange(duplicate.id, keeper, duplicate, locks, keeper.id),
      keeper.id,
    );
  });
});
