import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { buildAdminCompaniesApiUrl } from "@/src/features/companies/client/fetchAdminCompaniesCollection";
import { parseCompaniesListParamsFromLocationSearch } from "@/src/features/companies/client/companiesListCollectionState";
import {
  buildCompaniesListSearchParams,
  parseCompaniesListParams,
} from "@/src/features/companies/server/companiesListParams";
import {
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

describe("GET /api/admin/companies response contract", () => {
  it("route returns companies, total, and params", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/companies/route.ts"),
      "utf8",
    );
    assert.match(source, /buildAdminCompaniesCollection/);
    assert.match(source, /companies: result\.companies/);
    assert.match(source, /total: result\.total/);
    assert.match(source, /params: result\.params/);
    assert.match(source, /ok: true/);
  });
});

describe("admin companies navigation policy", () => {
  it("AdminCompaniesSearchForm does not use router.push or router.replace", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/companies/components/admin/AdminCompaniesSearchForm.tsx",
      ),
      "utf8",
    );
    assert.equal(source.includes("router.push"), false);
    assert.equal(source.includes("router.replace"), false);
    assert.equal(source.includes("useRouter"), false);
  });

  it("AdminCompaniesPage uses replaceHistoryUrl via collection hook", () => {
    const hookSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/companies/client/useAdminCompaniesCollection.ts",
      ),
      "utf8",
    );
    assert.match(hookSource, /replaceHistoryUrl/);
    assert.match(hookSource, /handlePopState/);
    assert.match(hookSource, /AbortController/);
    assert.match(hookSource, /shouldApplyCompaniesListFetchResult/);
  });

  it("filter chips use buttons instead of same-pathname links", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/companies/components/admin/AdminCompaniesFilterChips.tsx",
      ),
      "utf8",
    );
    assert.equal(source.includes("<Link"), false);
    assert.match(source, /onFilterChange/);
  });
});

describe("popstate restoration", () => {
  it("reads filter and search from window search params", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { search: "?filter=missing_logo&search=acme" },
      },
    });

    try {
      assert.deepEqual(parseCompaniesListParamsFromLocationSearch(readSearchParamsFromWindow()), {
        filter: "missing_logo",
        search: "acme",
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
  it("builds admin companies href without query when params are default", () => {
    const href = buildPathWithSearchParams(
      "/admin/companies",
      buildCompaniesListSearchParams({ filter: "all", search: "" }),
    );
    assert.equal(href, "/admin/companies");
  });

  it("builds admin companies API url for targeted fetch", () => {
    const url = buildAdminCompaniesApiUrl({
      filter: "missing_logo",
      search: "acme",
    });
    assert.equal(url, "/api/admin/companies?filter=missing_logo&search=acme");
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
      replaceHistoryUrl("/admin/companies?search=acme");
      assert.deepEqual(calls, ["/admin/companies?search=acme"]);
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
  it("keeps listCompaniesAdmin on the server page loader", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/admin/companies/page.tsx"),
      "utf8",
    );
    assert.match(source, /buildAdminCompaniesCollection/);
    assert.match(source, /parseCompaniesListParamsFromRecord/);
    assert.doesNotMatch(source, /router\.(push|replace)/);
  });
});

describe("row navigation remains cross-route", () => {
  it("AdminCompaniesListTable still navigates to company detail", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/companies/components/admin/AdminCompaniesListTable.tsx",
      ),
      "utf8",
    );
    assert.match(source, /router\.push\(detailHref\)/);
  });
});
