import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ExplorerResultsToolbar,
  formatExplorerResultsFoundLabel,
} from "@/src/components/common/explorer/ExplorerResultsToolbar";

const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "name", label: "Event Name" },
] as const;

describe("formatExplorerResultsFoundLabel", () => {
  it("uses singular grammar for one result", () => {
    assert.equal(
      formatExplorerResultsFoundLabel(1, "events").fullText,
      "1 event found",
    );
  });

  it("uses plural grammar for zero and many results", () => {
    assert.equal(
      formatExplorerResultsFoundLabel(0, "events").fullText,
      "0 events found",
    );
    assert.equal(
      formatExplorerResultsFoundLabel(84, "events").fullText,
      "84 events found",
    );
  });
});

describe("ExplorerResultsToolbar", () => {
  it("renders the normal non-loading count", () => {
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

  it("renders singular grammar when total is 1", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerResultsToolbar, {
        total: 1,
        entityLabel: "events",
        sort: "recommended",
        sortOptions: [...sortOptions],
        onSortChange: () => undefined,
      }),
    );

    assert.match(html, />1<\/span>\s*event found/);
    assert.doesNotMatch(html, /events found/);
  });

  it("pending with stale total 84 does not render 84 events found", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerResultsToolbar, {
        total: 84,
        entityLabel: "events",
        sort: "recommended",
        sortOptions: [...sortOptions],
        onSortChange: () => undefined,
        isPending: true,
      }),
    );

    assert.doesNotMatch(html, /84 events found/);
    assert.doesNotMatch(html, />84</);
    assert.match(html, /Updating results…/);
    assert.match(html, /role="status"/);
  });

  it("pending renders the chosen loading label", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerResultsToolbar, {
        total: 84,
        entityLabel: "events",
        sort: "recommended",
        sortOptions: [...sortOptions],
        onSortChange: () => undefined,
        isPending: true,
        pendingLabel: "Searching…",
      }),
    );

    assert.match(html, /Searching…/);
    assert.doesNotMatch(html, /Updating results…/);
    assert.doesNotMatch(html, /84/);
  });
});
