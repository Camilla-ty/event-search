import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminCompaniesListSkeleton } from "@/src/features/companies/components/admin/AdminCompaniesListSkeleton";

function renderSkeleton(filter: "all" | "needs_logo_review" = "all"): string {
  return renderToStaticMarkup(
    React.createElement(AdminCompaniesListSkeleton, { filter, rowCount: 3 }),
  );
}

describe("AdminCompaniesListSkeleton", () => {
  it("renders a table skeleton with logo, name, domain, and event links columns", () => {
    const html = renderSkeleton("all");

    assert.match(html, /aria-busy="true"/);
    assert.match(html, /aria-label="Loading companies"/);
    assert.match(html, /animate-pulse/);
    assert.match(html, />Logo</);
    assert.match(html, />Name</);
    assert.match(html, />Domain</);
    assert.match(html, />Event links</);
    assert.doesNotMatch(html, />Website</);
    assert.equal((html.match(/<tr/g) ?? []).length, 4);
    assert.equal((html.match(/h-10 w-10/g) ?? []).length, 3);
  });

  it("includes a website column for needs_logo_review filter", () => {
    const html = renderSkeleton("needs_logo_review");

    assert.match(html, />Website</);
    assert.equal((html.match(/<tr/g) ?? []).length, 4);
  });
});

describe("AdminCompaniesPage loading UX", () => {
  it("shows table skeleton when loading with no rows and preserves refresh dimming", () => {
    const source = readAdminCompaniesPageSource();

    assert.match(source, /showInitialSkeleton = isLoading && companies\.length === 0/);
    assert.match(source, /showRefreshingState = isLoading && companies\.length > 0/);
    assert.match(source, /showInitialSkeleton \? \(/);
    assert.match(source, /<AdminCompaniesListSkeleton filter=\{params\.filter\} \/>/);
    assert.match(source, /loading=\{showRefreshingState\}/);
    assert.match(source, /Updating results…/);
  });

  it("registers route-level loading UI for /admin/companies", () => {
    const source = readFile("src/app/admin/companies/loading.tsx");
    assert.match(source, /AdminCompaniesListSkeleton/);
    assert.match(source, /aria-busy="true"/);
  });
});

function readAdminCompaniesPageSource(): string {
  return readFile("src/features/companies/components/admin/AdminCompaniesPage.tsx");
}

function readFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}
