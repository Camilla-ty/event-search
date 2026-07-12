import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { buildAdminVenuesApiUrl } from "@/src/features/venues/client/fetchAdminVenuesCollection";
import { parseVenuesListParamsFromLocationSearch } from "@/src/features/venues/client/venuesListCollectionState";
import {
  buildVenuesListSearchParams,
  parseVenuesListParams,
} from "@/src/features/venues/server/venuesListParams";
import {
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

describe("GET /api/admin/venues response contract", () => {
  it("route returns venues, total, and params", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/venues/route.ts"),
      "utf8",
    );
    assert.match(source, /buildAdminVenuesCollection/);
    assert.match(source, /venues: result\.venues/);
    assert.match(source, /total: result\.total/);
    assert.match(source, /params: result\.params/);
    assert.match(source, /ok: true/);
  });
});

describe("admin venues navigation policy", () => {
  it("AdminVenuesSearchForm does not use router.push or router.replace", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/venues/components/admin/AdminVenuesSearchForm.tsx",
      ),
      "utf8",
    );
    assert.equal(source.includes("router.push"), false);
    assert.equal(source.includes("router.replace"), false);
    assert.equal(source.includes("useRouter"), false);
  });

  it("useAdminVenuesCollection uses replaceHistoryUrl and abort protection", () => {
    const hookSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/venues/client/useAdminVenuesCollection.ts",
      ),
      "utf8",
    );
    assert.match(hookSource, /replaceHistoryUrl/);
    assert.match(hookSource, /handlePopState/);
    assert.match(hookSource, /AbortController/);
    assert.match(hookSource, /shouldApplyVenuesListFetchResult/);
  });

  it("include archived toggle uses callback not Link", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/venues/components/admin/AdminVenuesIncludeArchivedToggle.tsx",
      ),
      "utf8",
    );
    assert.equal(source.includes("<Link"), false);
    assert.match(source, /onToggle/);
  });
});

describe("popstate restoration", () => {
  it("reads search and includeArchived from window search params", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { search: "?search=berlin&includeArchived=true" },
      },
    });

    try {
      assert.deepEqual(parseVenuesListParamsFromLocationSearch(readSearchParamsFromWindow()), {
        search: "berlin",
        includeArchived: true,
      });
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});

describe("replaceHistoryUrl usage", () => {
  it("builds admin venues href without query when params are default", () => {
    const href = buildPathWithSearchParams(
      "/admin/venues",
      buildVenuesListSearchParams({ search: "", includeArchived: false }),
    );
    assert.equal(href, "/admin/venues");
  });

  it("builds admin venues API url for targeted fetch", () => {
    const url = buildAdminVenuesApiUrl({
      search: "berlin",
      includeArchived: true,
    });
    assert.equal(url, "/api/admin/venues?search=berlin&includeArchived=true");
  });

  it("records replaceState calls", () => {
    const calls: string[] = [];
    const originalWindow = globalThis.window;
    const originalHistory = globalThis.history;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis, "history", {
      configurable: true,
      value: {
        replaceState: (_state: unknown, _title: string, url: string) => {
          calls.push(url);
        },
      },
    });

    try {
      replaceHistoryUrl("/admin/venues?search=berlin");
      assert.deepEqual(calls, ["/admin/venues?search=berlin"]);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
      Object.defineProperty(globalThis, "history", {
        configurable: true,
        value: originalHistory,
      });
    }
  });
});

describe("cold-load server behavior", () => {
  it("keeps listVenuesAdmin on the server page loader", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/admin/venues/page.tsx"),
      "utf8",
    );
    assert.match(source, /buildAdminVenuesCollection/);
    assert.match(source, /parseVenuesListParamsFromRecord/);
    assert.doesNotMatch(source, /router\.(push|replace)/);
  });
});

describe("view navigation remains cross-route", () => {
  it("AdminVenuesListTable still links to venue detail", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/venues/components/admin/AdminVenuesListTable.tsx",
      ),
      "utf8",
    );
    assert.match(source, /href=\{`\/admin\/venues\/\$\{venue\.id\}`\}/);
  });
});
