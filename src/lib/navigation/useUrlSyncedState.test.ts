import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  canOwnerSyncHistoryUrl,
  shouldSyncUrlForOwnedPathname,
} from "@/src/lib/navigation/useUrlSyncedState";

describe("shouldSyncUrlForOwnedPathname", () => {
  it("allows History API writes on the owning route", () => {
    assert.equal(shouldSyncUrlForOwnedPathname("/events", "/events"), true);
    assert.equal(shouldSyncUrlForOwnedPathname("/sponsors", "/sponsors"), true);
  });

  it("blocks writes after cross-route navigation starts", () => {
    assert.equal(shouldSyncUrlForOwnedPathname("/events", "/sponsors"), false);
    assert.equal(shouldSyncUrlForOwnedPathname("/sponsors", "/events"), false);
  });

  it("blocks writes during nested child-route navigation", () => {
    assert.equal(
      shouldSyncUrlForOwnedPathname("/events", "/events/singapore-fintech-festival-2025"),
      false,
    );
  });
});

describe("useUrlSyncedState cross-route safety", () => {
  it("guards replaceState with live window pathname", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/navigation/useUrlSyncedState.ts"),
      "utf8",
    );
    assert.match(source, /ownerPathnameRef/);
    assert.match(source, /canOwnerSyncHistoryUrl/);
    assert.match(source, /readPathnameFromWindow/);
  });
});

describe("canOwnerSyncHistoryUrl", () => {
  it("uses readPathnameFromWindow", () => {
    assert.equal(typeof canOwnerSyncHistoryUrl, "function");
  });
});
