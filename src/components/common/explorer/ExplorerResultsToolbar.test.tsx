import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExplorerResultsToolbar } from "@/src/components/common/explorer/ExplorerResultsToolbar";

const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "name", label: "Event Name" },
] as const;

function renderToolbar(overrides: { total?: number; isLoading?: boolean } = {}) {
  return renderToStaticMarkup(
    React.createElement(ExplorerResultsToolbar, {
      total: overrides.total ?? 83,
      entityLabel: "events",
      sort: "recommended",
      sortOptions: [...sortOptions],
      onSortChange: () => undefined,
      isLoading: overrides.isLoading,
    }),
  );
}

describe("ExplorerResultsToolbar loading status", () => {
  it("shows Updating results… during loading and hides the previous total", () => {
    const html = renderToolbar({ total: 83, isLoading: true });

    assert.match(html, /Updating results…/);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /83/);
    assert.doesNotMatch(html, /events found/);
  });

  it("shows the new total after loading completes", () => {
    const html = renderToolbar({ total: 3, isLoading: false });

    assert.match(html, /3/);
    assert.match(html, /events found/);
    assert.doesNotMatch(html, /Updating results…/);
  });

  it("keeps the sort control available while loading", () => {
    const html = renderToolbar({ isLoading: true });

    assert.match(html, /<select/);
    assert.match(html, /Sort by/);
    assert.doesNotMatch(html, /disabled/);
  });
});
