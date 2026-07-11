import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  LoadingStatus,
  SkeletonBlock,
  SkeletonLine,
  Spinner,
} from "@/src/components/common/loading/primitives";

describe("loading primitives", () => {
  it("SkeletonBlock and SkeletonLine are aria-hidden", () => {
    const block = renderToStaticMarkup(
      React.createElement(SkeletonBlock, { className: "h-10 w-10" }),
    );
    const line = renderToStaticMarkup(
      React.createElement(SkeletonLine, { className: "w-24" }),
    );

    assert.match(block, /aria-hidden="true"/);
    assert.match(line, /aria-hidden="true"/);
  });

  it("Spinner is aria-hidden without a label", () => {
    const html = renderToStaticMarkup(React.createElement(Spinner));
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /animate-spin/);
  });

  it("Spinner exposes an accessible name when label is provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(Spinner, { label: "Loading" }),
    );
    assert.match(html, /role="img"/);
    assert.match(html, /aria-label="Loading"/);
    assert.doesNotMatch(html, /aria-hidden="true"/);
  });

  it("LoadingStatus exposes status semantics and shows spinner by default", () => {
    const html = renderToStaticMarkup(
      React.createElement(LoadingStatus, { message: "Searching…" }),
    );

    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /Searching…/);
    assert.match(html, /animate-spin/);
    assert.match(html, /flex items-center gap-2 text-sm text-slate-600/);
  });

  it("LoadingStatus can hide the spinner", () => {
    const html = renderToStaticMarkup(
      React.createElement(LoadingStatus, {
        message: "Applying filters…",
        showSpinner: false,
      }),
    );

    assert.doesNotMatch(html, /animate-spin/);
    assert.match(html, /Applying filters…/);
  });
});
