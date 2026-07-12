import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyVenuesListIncludeArchivedChange,
  applyVenuesListSearchChange,
  buildVenuesListParamsKey,
  shouldApplyVenuesListFetchResult,
  toggleVenuesListIncludeArchived,
} from "@/src/features/venues/client/venuesListCollectionState";
import {
  buildVenuesListSearchParams,
  parseIncludeArchivedParam,
  parseVenuesListParams,
} from "@/src/features/venues/server/venuesListParams";

describe("parseIncludeArchivedParam", () => {
  it("falls back to false for invalid includeArchived values", () => {
    assert.equal(parseIncludeArchivedParam(undefined), false);
    assert.equal(parseIncludeArchivedParam("maybe"), false);
    assert.equal(parseIncludeArchivedParam("false"), false);
    assert.equal(parseIncludeArchivedParam("true"), true);
  });
});

describe("parseVenuesListParams", () => {
  it("round-trips search and includeArchived params", () => {
    const parsed = parseVenuesListParams(
      new URLSearchParams("search=berlin&includeArchived=true"),
    );
    assert.deepEqual(parsed, {
      search: "berlin",
      includeArchived: true,
    });

    const serialized = buildVenuesListSearchParams(parsed);
    assert.equal(serialized.toString(), "search=berlin&includeArchived=true");
    assert.deepEqual(parseVenuesListParams(serialized), parsed);
  });

  it("omits empty search and false includeArchived from serialized params", () => {
    const serialized = buildVenuesListSearchParams({
      search: "",
      includeArchived: false,
    });
    assert.equal(serialized.toString(), "");
  });
});

describe("venues list collection state", () => {
  it("preserves search when includeArchived toggles", () => {
    const next = toggleVenuesListIncludeArchived({
      search: "berlin",
      includeArchived: false,
    });
    assert.deepEqual(next, {
      search: "berlin",
      includeArchived: true,
    });
  });

  it("preserves includeArchived when search changes", () => {
    const next = applyVenuesListSearchChange(
      { search: "", includeArchived: true },
      "  expo  ",
    );
    assert.deepEqual(next, {
      search: "expo",
      includeArchived: true,
    });
  });

  it("clears search", () => {
    const next = applyVenuesListSearchChange(
      { search: "hall", includeArchived: true },
      "",
    );
    assert.equal(next.search, "");
    assert.equal(next.includeArchived, true);
  });

  it("sets includeArchived explicitly", () => {
    const next = applyVenuesListIncludeArchivedChange(
      { search: "hall", includeArchived: false },
      true,
    );
    assert.equal(next.includeArchived, true);
  });

  it("builds stable params keys", () => {
    assert.equal(
      buildVenuesListParamsKey({ search: "berlin", includeArchived: true }),
      buildVenuesListParamsKey({ search: "berlin", includeArchived: true }),
    );
    assert.notEqual(
      buildVenuesListParamsKey({ search: "berlin", includeArchived: false }),
      buildVenuesListParamsKey({ search: "berlin", includeArchived: true }),
    );
  });

  it("ignores stale fetch results", () => {
    assert.equal(shouldApplyVenuesListFetchResult(1, 2), false);
    assert.equal(shouldApplyVenuesListFetchResult(2, 2), true);
  });
});
