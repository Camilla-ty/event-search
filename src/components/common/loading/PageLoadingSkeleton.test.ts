import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PageLoadingSkeleton } from "@/src/components/common/loading/PageLoadingSkeleton";

function renderVariant(variant: "list" | "detail" | "form" | "explorer"): string {
  return renderToStaticMarkup(React.createElement(PageLoadingSkeleton, { variant }));
}

function countMatches(html: string, pattern: RegExp): number {
  return [...html.matchAll(pattern)].length;
}

describe("PageLoadingSkeleton", () => {
  it("renders list variant with five card placeholders", () => {
    const html = renderVariant("list");

    assert.match(html, /aria-busy="true"/);
    assert.match(html, /aria-label="Loading list"/);
    assert.match(html, /animate-pulse/);
    assert.equal(countMatches(html, /h-28/g), 5);
    assert.equal(countMatches(html, /bg-slate-100/g), 5);
    assert.equal(countMatches(html, /border-slate-200/g), 5);
  });

  it("renders detail variant with header, grid, and footer blocks", () => {
    const html = renderVariant("detail");

    assert.match(html, /aria-label="Loading content"/);
    assert.match(html, /aspect-\[16\/9\]/);
    assert.match(html, /lg:grid-cols-\[minmax\(0,380px\)_1fr\]/);
    assert.match(html, /h-40/);
    assert.match(html, /rounded-xl/);
    assert.match(html, /bg-slate-200/);
  });

  it("renders form variant with three field groups and submit block", () => {
    const html = renderVariant("form");

    assert.match(html, /aria-label="Loading form"/);
    assert.match(html, /rounded-xl border border-slate-200 bg-white p-6/);
    assert.equal(countMatches(html, /space-y-2/g), 3);
    assert.equal(countMatches(html, /\bh-10\b/g), 4);
  });

  it("renders explorer variant with sidebar shell and four result cards", () => {
    const html = renderVariant("explorer");

    assert.match(html, /aria-label="Loading explorer"/);
    assert.match(html, /lg:grid-cols-\[280px_minmax\(0,1fr\)\]/);
    assert.match(html, /hidden h-72 rounded-xl border border-slate-200 bg-white md:block/);
    assert.equal(countMatches(html, /h-28/g), 4);
    assert.equal(countMatches(html, /bg-slate-100/g), 4);
  });

  it("marks decorative skeleton children aria-hidden", () => {
    const html = renderVariant("list");
    assert.match(html, /aria-hidden="true"/);
  });
});
