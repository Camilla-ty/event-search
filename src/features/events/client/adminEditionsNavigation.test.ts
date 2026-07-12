import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { buildAdminEditionsApiUrl } from "@/src/features/events/client/fetchAdminEditionsCollection";
import { parseEditionsListParamsFromLocationSearch } from "@/src/features/events/client/editionsListCollectionState";
import {
  buildEditionsListSearchParams,
  parseEditionsListParams,
} from "@/src/features/events/server/editionsListParams";
import {
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

describe("GET /api/admin/event-editions response contract", () => {
  it("route returns editions, total, and params", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/event-editions/route.ts"),
      "utf8",
    );
    assert.match(source, /buildAdminEditionsCollection/);
    assert.match(source, /editions: result\.editions/);
    assert.match(source, /total: result\.total/);
    assert.match(source, /params: result\.params/);
    assert.match(source, /ok: true/);
  });
});

describe("admin editions navigation policy", () => {
  it("useAdminEditionsCollection uses replaceHistoryUrl and abort protection", () => {
    const hookSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/client/useAdminEditionsCollection.ts",
      ),
      "utf8",
    );
    assert.match(hookSource, /replaceHistoryUrl/);
    assert.match(hookSource, /handlePopState/);
    assert.match(hookSource, /AbortController/);
    assert.match(hookSource, /shouldApplyEditionsListFetchResult/);
  });

  it("filter chips use buttons instead of same-pathname links", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/admin/AdminEventEditionsFilterChips.tsx",
      ),
      "utf8",
    );
    assert.equal(source.includes("<Link"), false);
    assert.match(source, /onFilterChange/);
  });

  it("AdminEventEditionsPage does not use router.push or router.replace", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/admin/AdminEventEditionsPage.tsx",
      ),
      "utf8",
    );
    assert.equal(source.includes("router.push"), false);
    assert.equal(source.includes("router.replace"), false);
    assert.equal(source.includes("useRouter"), false);
  });
});

describe("popstate restoration", () => {
  it("reads missing filters from window search params", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { search: "?missingWebsite=1&missingCity=1" },
      },
    });

    try {
      assert.deepEqual(parseEditionsListParamsFromLocationSearch(readSearchParamsFromWindow()), {
        missingWebsite: true,
        missingDates: false,
        missingCity: true,
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
  it("builds admin editions href without query when params are default", () => {
    const href = buildPathWithSearchParams(
      "/admin/events/editions",
      buildEditionsListSearchParams({
        missingWebsite: false,
        missingDates: false,
        missingCity: false,
      }),
    );
    assert.equal(href, "/admin/events/editions");
  });

  it("builds admin editions API url for targeted fetch", () => {
    const url = buildAdminEditionsApiUrl({
      missingWebsite: true,
      missingDates: false,
      missingCity: false,
    });
    assert.equal(url, "/api/admin/event-editions?missingWebsite=1");
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
      replaceHistoryUrl("/admin/events/editions?missingDates=1");
      assert.deepEqual(calls, ["/admin/events/editions?missingDates=1"]);
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
  it("keeps listEventEditionsAdmin on the server collection builder", () => {
    const pageSource = readFileSync(
      path.join(process.cwd(), "src/app/admin/events/editions/page.tsx"),
      "utf8",
    );
    assert.match(pageSource, /buildAdminEditionsCollection/);
    assert.match(pageSource, /parseEditionsListParamsFromRecord/);
    assert.doesNotMatch(pageSource, /router\.(push|replace)/);

    const collectionSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/server/adminEditionsCollection.ts",
      ),
      "utf8",
    );
    assert.match(collectionSource, /listEventEditionsAdmin/);
  });
});

describe("view navigation remains cross-route", () => {
  it("AdminEventEditionsListTable still links to edition detail", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/admin/AdminEventEditionsListTable.tsx",
      ),
      "utf8",
    );
    assert.match(source, /href=\{`\/admin\/events\/editions\/\$\{edition\.id\}`\}/);
  });
});
