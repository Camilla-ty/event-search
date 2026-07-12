import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  canOwnerSyncHistoryUrl,
  shouldSyncUrlForOwnedPathname,
} from "@/src/lib/navigation/useUrlSyncedState";

describe("shouldSyncUrlForOwnedPathname", () => {
  it("allows History API writes on the exact owning route", () => {
    assert.equal(shouldSyncUrlForOwnedPathname("/events", "/events"), true);
    assert.equal(shouldSyncUrlForOwnedPathname("/sponsors", "/sponsors"), true);
    assert.equal(shouldSyncUrlForOwnedPathname("/admin/companies", "/admin/companies"), true);
  });

  it("blocks writes after sibling-route navigation", () => {
    assert.equal(shouldSyncUrlForOwnedPathname("/events", "/sponsors"), false);
    assert.equal(shouldSyncUrlForOwnedPathname("/sponsors", "/events"), false);
  });

  it("blocks writes during nested child-route navigation", () => {
    assert.equal(
      shouldSyncUrlForOwnedPathname("/events", "/events/singapore-fintech-festival-2025"),
      false,
    );
    assert.equal(
      shouldSyncUrlForOwnedPathname("/sponsors", "/sponsors/acme-corp"),
      false,
    );
    assert.equal(
      shouldSyncUrlForOwnedPathname("/admin/companies", "/admin/companies/company-id"),
      false,
    );
  });
});

describe("canOwnerSyncHistoryUrl", () => {
  it("reads the live browser pathname", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          pathname: "/events/token2049-singapore-2025",
          search: "",
        },
      },
    });

    try {
      assert.equal(canOwnerSyncHistoryUrl("/events"), false);
      assert.equal(canOwnerSyncHistoryUrl("/events/token2049-singapore-2025"), true);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});

describe("useUrlSyncedState ownership", () => {
  it("guards writes with canOwnerSyncHistoryUrl and owner pathname builds", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/navigation/useUrlSyncedState.ts"),
      "utf8",
    );

    assert.match(source, /canOwnerSyncHistoryUrl\(ownerPathname\)/);
    assert.match(source, /buildPath\(ownerPathname, serialize\(state\)\)/);
    assert.doesNotMatch(source, /\[state, pathname, serialize/);
  });
});

describe("event result card navigation", () => {
  it("EventCard uses Next.js Link without preventDefault", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/events/components/explorer/EventCard.tsx"),
      "utf8",
    );

    assert.match(source, /<Link href=\{href\}/);
    assert.equal(source.includes("preventDefault"), false);
    assert.match(source, /buildEventDetailPath/);
  });
});

describe("collection hooks use window pathname ownership", () => {
  const hookFiles = [
    "src/features/sponsors/client/useSponsorDiscoveryCollection.ts",
    "src/features/companies/client/useAdminCompaniesCollection.ts",
    "src/features/venues/client/useAdminVenuesCollection.ts",
    "src/features/events/client/useAdminEditionsCollection.ts",
  ] as const;

  for (const relativePath of hookFiles) {
    it(`${relativePath} blocks replaceState after destination navigation begins`, () => {
      const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");

      assert.match(source, /canOwnerSyncHistoryUrl/);
      assert.match(source, /ownerPathnameRef/);
      assert.match(source, /build\w+Href\(ownerPathname, params\)/);
    });
  }
});

describe("same-page optimizations remain intact", () => {
  it("Event Explorer still uses useUrlSyncedState for filter URL sync", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/events/components/explorer/EventExplorerPage.tsx"),
      "utf8",
    );

    assert.match(source, /useUrlSyncedState/);
    assert.match(source, /history: "replace"/);
  });

  it("Sponsor discovery still uses targeted fetch", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsors/client/useSponsorDiscoveryCollection.ts"),
      "utf8",
    );

    assert.match(source, /fetchSponsorDiscoveryCollection/);
    assert.equal(source.includes("router.push"), false);
  });

  it("admin list tables still navigate to detail routes", () => {
    const companies = readFileSync(
      path.join(
        process.cwd(),
        "src/features/companies/components/admin/AdminCompaniesListTable.tsx",
      ),
      "utf8",
    );
    const sponsors = readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsors/components/search/SponsorDiscoveryTable.tsx",
      ),
      "utf8",
    );

    assert.match(companies, /router\.push\(detailHref\)/);
    assert.match(sponsors, /router\.push\(profileHref\)/);
  });
});
