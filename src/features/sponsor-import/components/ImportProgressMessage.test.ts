import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ImportProgressMessage } from "@/src/features/sponsor-import/components/ImportProgressMessage";

describe("ImportProgressMessage", () => {
  it("preserves status markup and spinner classes", () => {
    const html = renderToStaticMarkup(
      React.createElement(ImportProgressMessage, { message: "Importing sponsors…" }),
    );

    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /flex items-center gap-2 text-sm text-slate-600/);
    assert.match(html, /inline-block/);
    assert.match(html, /h-4 w-4/);
    assert.match(html, /animate-spin/);
    assert.match(html, /rounded-full border-2 border-slate-300 border-t-brand-primary/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /Importing sponsors…/);
  });
});
