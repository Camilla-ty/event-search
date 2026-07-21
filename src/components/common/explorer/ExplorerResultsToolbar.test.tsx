import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExplorerResultsToolbar } from "@/src/components/common/explorer/ExplorerResultsToolbar";

const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "name", label: "Event Name" },
] as const;

describe("ExplorerResultsToolbar", () => {
  it("always shows the result count (no Updating results status)", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerResultsToolbar, {
        total: 83,
        entityLabel: "events",
        sort: "recommended",
        sortOptions: [...sortOptions],
        onSortChange: () => undefined,
      }),
    );

    assert.match(html, /83/);
    assert.match(html, /events found/);
    assert.doesNotMatch(html, /Updating results/);
    assert.doesNotMatch(html, /role="status"/);
  });
});
